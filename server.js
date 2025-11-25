require("dotenv").config(); // Обязательно первая строка

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { randomInt } = require("crypto");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Создаем папку для тестов, если её нет
const testsDir = path.join(__dirname, "tests");
if (!fs.existsSync(testsDir)) {
  fs.mkdirSync(testsDir);
}

function parse_ai_response_to_json(aiResponse, testData) {
  try {
    const questionBlocks = aiResponse
      .split(/\n\s*\n/)
      .filter((block) => block.trim());
    const questions = [];

    for (const block of questionBlocks) {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);
      const questionData = {};

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith("Вопрос:")) {
          questionData.question = line.replace("Вопрос:", "").trim();
        } else if (line.startsWith("Варианты:")) {
          const options = [];
          for (let j = 1; j <= 3; j++) {
            if (i + j < lines.length) {
              const optionLine = lines[i + j];
              const optionText = optionLine.replace(/^\d+\.\s*/, "");
              if (optionText && !optionText.startsWith("Правильный ответ:")) {
                options.push(optionText);
              }
            }
          }
          questionData.options = options;
        } else if (line.startsWith("Правильный ответ:")) {
          const correctAnswer = line.replace("Правильный ответ:", "").trim();
          try {
            questionData.correctAnswer = parseInt(correctAnswer) - 1;
            if (
              questionData.correctAnswer < 0 ||
              questionData.correctAnswer > 2
            ) {
              questionData.correctAnswer = 0;
            }
          } catch (error) {
            questionData.correctAnswer = 0;
          }
        }
      }

      if (
        questionData.question &&
        questionData.options &&
        questionData.options.length === 3 &&
        typeof questionData.correctAnswer === "number"
      ) {
        questions.push(questionData);
      }
    }

    const testStructure = {
      id: randomInt(100000, 999999),
      name: testData.testName || `Тест по ${testData.specificField}`,
      questions: questions,
      topic: testData.specificField,
      difficulty: testData.difficulty,
      createdAt: new Date().toISOString(),
    };

    return testStructure;
  } catch (error) {
    console.error("Ошибка парсинга ответа AI:", error);
    throw new Error("Ошибка обработки данных от нейросети");
  }
}

async function generateWithAI(testData) {
  try {
    if (!process.env.KEY) {
      throw new Error("API ключ не найден в .env файле");
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Test Generator Server",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat",
          messages: [
            {
              role: "user",
              content: `Сгенерируй тест по западной тематике со следующими параметрами:\n- Количество вопросов: ${testData.questionCount}\n- Сложность: ${testData.difficulty}\n- Категория: ${testData.category}\n- Тема: {${testData.specificField}}\n\nФормат каждого вопроса:\nВопрос: [текст вопроса]\Варианты:\n1. [вариант 1]\n2. [вариант 2]\n3. [вариант 3]\nПравильный ответ: [номер правильного варианта]\n\nСгенерируй вопросы в соответствии с категорией и темой. Каждый вопрос должен иметь 3 варианта ответа. Правильный ответ указывай цифрой от 1 до 3. Разделяй вопросы пустой строкой.`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("Получен пустой ответ от AI");
    }

    return parse_ai_response_to_json(aiResponse, testData);
  } catch (error) {
    console.error("Ошибка внутри generateWithAI:", error.message);
    // ВАЖНО: Выбрасываем ошибку дальше, чтобы остановить сохранение файла
    throw error;
  }
}

app.post("/generate-test", async (req, res) => {
  try {
    console.log("Получены данные:", req.body);

    // Генерируем тест (если будет ошибка, код сразу перейдет в catch)
    const test = await generateWithAI(req.body);

    // Код ниже выполнится ТОЛЬКО если ошибок не было
    const filename = `test_${test.id}.json`;
    const filepath = path.join(testsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(test, null, 2));
    console.log(`Тест сохранен в файл: ${filename}`);

    res.json({
      success: true,
      testId: test.id,
      message: "Тест успешно создан и сохранен",
    });
  } catch (error) {
    console.error("Генерация прервана:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Ошибка генерации теста",
    });
  }
});

app.get("/test/:testId", (req, res) => {
  try {
    const testId = req.params.testId;
    const filename = `test_${testId}.json`;
    const filepath = path.join(testsDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: "Тест не найден",
      });
    }

    const testData = fs.readFileSync(filepath, "utf8");
    const test = JSON.parse(testData);

    res.json({
      success: true,
      test: test,
    });
  } catch (error) {
    console.error("Ошибка загрузки теста:", error);
    res.status(500).json({
      success: false,
      error: "Ошибка загрузки теста",
    });
  }
});

app.get("/tests", (req, res) => {
  try {
    const files = fs.readdirSync(testsDir);
    const tests = files.map((filename) => {
      const filepath = path.join(testsDir, filename);
      const data = fs.readFileSync(filepath, "utf8");
      const test = JSON.parse(data);
      return {
        id: test.id,
        name: test.name,
        createdAt: test.createdAt,
        questionCount: test.questions ? test.questions.length : 0,
      };
    });

    res.json({
      success: true,
      tests: tests,
    });
  } catch (error) {
    console.error("Ошибка получения списка тестов:", error);
    res.status(500).json({
      success: false,
      error: "Ошибка получения списка тестов",
    });
  }
});

app.listen(3000, () => {
  console.log("Сервер запущен на http://localhost:3000");
  console.log(`Тесты сохраняются в папку: ${testsDir}`);
});
