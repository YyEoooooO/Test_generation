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

    const maxAttempts = 3; // Максимальное количество попыток
    let attempt = 0;
    let test = null;

    while (attempt < maxAttempts) {
      try {
        console.log(`Попытка генерации теста ${attempt + 1}/${maxAttempts}`);
        
        // Генерируем тест
        test = await generateWithAI(req.body);
        
        // Проверяем, есть ли вопросы в тесте
        if (test.questions && test.questions.length > 0) {
          console.log(`Успешно сгенерирован тест с ${test.questions.length} вопросами`);
          break; // Выходим из цикла если тест с вопросами
        } else {
          console.log(`Попытка ${attempt + 1}: получен тест без вопросов, повторяем...`);
        }
      } catch (error) {
        console.log(`Попытка ${attempt + 1} неудачна:`, error.message);
        
        // Если это последняя попытка - пробрасываем ошибку дальше
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
      
      attempt++;
      
      // Небольшая задержка между попытками (опционально)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Если после всех попыток тест пустой
    if (!test || !test.questions || test.questions.length === 0) {
      throw new Error("Не удалось сгенерировать тест с вопросами после нескольких попыток");
    }

    // Сохраняем тест
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
















// require("dotenv").config(); // Обязательно первая строка

// const express = require("express");
// const cors = require("cors");
// const fs = require("fs");
// const path = require("path");
// const { randomInt } = require("crypto");
// const app = express();

// app.use(cors());
// app.use(express.json());
// app.use(express.static("public"));

// // Создаем папку для тестов, если её нет
// const testsDir = path.join(__dirname, "tests");
// if (!fs.existsSync(testsDir)) {
//   fs.mkdirSync(testsDir);
// }

// function parse_ai_response_to_json(aiResponse, testData) {
//   try {
//     const questionBlocks = aiResponse
//       .split(/\n\s*\n/)
//       .filter((block) => block.trim());
//     const questions = [];

//     for (const block of questionBlocks) {
//       const lines = block
//         .split("\n")
//         .map((line) => line.trim())
//         .filter((line) => line);
//       const questionData = {};

//       for (let i = 0; i < lines.length; i++) {
//         const line = lines[i];

//         if (line.startsWith("Вопрос:")) {
//           questionData.question = line.replace("Вопрос:", "").trim();
//         } else if (line.startsWith("Варианты:")) {
//           const options = [];
//           for (let j = 1; j <= 3; j++) {
//             if (i + j < lines.length) {
//               const optionLine = lines[i + j];
//               const optionText = optionLine.replace(/^\d+\.\s*/, "");
//               if (optionText && !optionText.startsWith("Правильный ответ:")) {
//                 options.push(optionText);
//               }
//             }
//           }
//           questionData.options = options;
//         } else if (line.startsWith("Правильный ответ:")) {
//           const correctAnswer = line.replace("Правильный ответ:", "").trim();
//           try {
//             questionData.correctAnswer = parseInt(correctAnswer) - 1;
//             if (
//               questionData.correctAnswer < 0 ||
//               questionData.correctAnswer > 2
//             ) {
//               questionData.correctAnswer = 0;
//             }
//           } catch (error) {
//             questionData.correctAnswer = 0;
//           }
//         }
//       }

//       if (
//         questionData.question &&
//         questionData.options &&
//         questionData.options.length === 3 &&
//         typeof questionData.correctAnswer === "number"
//       ) {
//         questions.push(questionData);
//       }
//     }

//     const testStructure = {
//       id: randomInt(100000, 999999),
//       name: testData.testName || `Тест по ${testData.specificField}`,
//       questions: questions,
//       topic: testData.specificField,
//       difficulty: testData.difficulty,
//       createdAt: new Date().toISOString(),
//     };

//     return testStructure;
//   } catch (error) {
//     console.error("Ошибка парсинга ответа AI:", error);
//     throw new Error("Ошибка обработки данных от нейросети");
//   }
// }

// async function generateWithAI(testData) {
//   try {
//     const apiKey = process.env.GEMINI_API_KEY;
//     if (!apiKey) {
//       throw new Error("GEMINI_API_KEY не найден в .env файле");
//     }

//     // Исправленный URL для Gemini API
//     const response = await fetch(
//       `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           contents: [{
//             parts: [{
//               text: `Сгенерируй тест по программированию со следующими параметрами:
// - Количество вопросов: ${testData.questionCount}
// - Сложность: ${testData.difficulty}
// - Категория: ${testData.category}
// - Тема: ${testData.specificField}

// Формат каждого вопроса:
// Вопрос: [текст вопроса]
// Варианты:
// 1. [вариант 1]
// 2. [вариант 2]
// 3. [вариант 3]
// Правильный ответ: [номер правильного варианта]

// Сгенерируй вопросы в соответствии с категорией и темой. Каждый вопрос должен иметь 3 варианта ответа. Правильный ответ указывай цифрой от 1 до 3. Разделяй вопросы пустой строкой.`
//             }]
//           }],
//           generationConfig: {
//             temperature: 0.7,
//             maxOutputTokens: 2048,
//           }
//         }),
//       }
//     );

//     if (!response.ok) {
//       // Добавляем больше информации об ошибке
//       const errorText = await response.text();
//       console.error("Полный ответ ошибки:", errorText);
//       throw new Error(`Ошибка HTTP: ${response.status} - ${response.statusText}`);
//     }

//     const data = await response.json();
    
//     // Проверяем структуру ответа Gemini
//     if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
//       console.error("Неожиданная структура ответа Gemini:", JSON.stringify(data, null, 2));
//       throw new Error("Неверная структура ответа от Gemini API");
//     }
    
//     const aiResponse = data.candidates[0].content.parts[0].text;

//     if (!aiResponse) {
//       throw new Error("Получен пустой ответ от AI");
//     }

//     console.log("Получен ответ от Gemini:", aiResponse.substring(0, 200) + "...");
//     return parse_ai_response_to_json(aiResponse, testData);
//   } catch (error) {
//     console.error("Ошибка внутри generateWithAI:", error.message);
//     throw error;
//   }
// }

// // Альтернативная функция на случай проблем с Gemini
// async function generateWithAIFallback(testData) {
//   try {
//     // Простая заглушка с тестовыми вопросами
//     const testQuestions = [
//       {
//         question: `Что такое ${testData.specificField}?`,
//         options: [
//           "Язык программирования",
//           "Фреймворк для разработки",
//           "Методология тестирования"
//         ],
//         correctAnswer: 0
//       },
//       {
//         question: `Какой основной принцип ${testData.specificField}?`,
//         options: [
//           "Инкапсуляция",
//           "Наследование", 
//           "Полиморфизм"
//         ],
//         correctAnswer: 1
//       }
//     ];

//     const testStructure = {
//       id: randomInt(100000, 999999),
//       name: testData.testName || `Тест по ${testData.specificField}`,
//       questions: testQuestions,
//       topic: testData.specificField,
//       difficulty: testData.difficulty,
//       createdAt: new Date().toISOString(),
//     };

//     return testStructure;
//   } catch (error) {
//     console.error("Ошибка в fallback генераторе:", error.message);
//     throw error;
//   }
// }

// app.post("/generate-test", async (req, res) => {
//   try {
//     console.log("Получены данные:", req.body);

//     const maxAttempts = 3;
//     let attempt = 0;
//     let test = null;

//     while (attempt < maxAttempts) {
//       try {
//         console.log(`Попытка генерации теста ${attempt + 1}/${maxAttempts}`);
        
//         // Пробуем сгенерировать тест
//         test = await generateWithAI(req.body);
        
//         // Проверяем, есть ли вопросы в тесте
//         if (test.questions && test.questions.length > 0) {
//           console.log(`Успешно сгенерирован тест с ${test.questions.length} вопросами`);
//           break;
//         } else {
//           console.log(`Попытка ${attempt + 1}: получен тест без вопросов, повторяем...`);
//         }
//       } catch (error) {
//         console.log(`Попытка ${attempt + 1} неудачна:`, error.message);
        
//         // Если это последняя попытка - используем fallback
//         if (attempt === maxAttempts - 1) {
//           console.log("Все попытки провалились, используем fallback...");
//           test = await generateWithAIFallback(req.body);
//           break;
//         }
//       }
      
//       attempt++;
      
//       // Задержка между попытками
//       if (attempt < maxAttempts) {
//         await new Promise(resolve => setTimeout(resolve, 1000));
//       }
//     }

//     // Если после всех попыток тест пустой
//     if (!test || !test.questions || test.questions.length === 0) {
//       throw new Error("Не удалось сгенерировать тест с вопросами после нескольких попыток");
//     }

//     // Сохраняем тест
//     const filename = `test_${test.id}.json`;
//     const filepath = path.join(testsDir, filename);

//     fs.writeFileSync(filepath, JSON.stringify(test, null, 2));
//     console.log(`Тест сохранен в файл: ${filename}`);

//     res.json({
//       success: true,
//       testId: test.id,
//       message: "Тест успешно создан и сохранен",
//     });
//   } catch (error) {
//     console.error("Генерация прервана:", error.message);
//     res.status(500).json({
//       success: false,
//       error: error.message || "Ошибка генерации теста",
//     });
//   }
// });

// app.get("/test/:testId", (req, res) => {
//   try {
//     const testId = req.params.testId;
//     const filename = `test_${testId}.json`;
//     const filepath = path.join(testsDir, filename);

//     if (!fs.existsSync(filepath)) {
//       return res.status(404).json({
//         success: false,
//         error: "Тест не найден",
//       });
//     }

//     const testData = fs.readFileSync(filepath, "utf8");
//     const test = JSON.parse(testData);

//     res.json({
//       success: true,
//       test: test,
//     });
//   } catch (error) {
//     console.error("Ошибка загрузки теста:", error);
//     res.status(500).json({
//       success: false,
//       error: "Ошибка загрузки теста",
//     });
//   }
// });

// app.get("/tests", (req, res) => {
//   try {
//     const files = fs.readdirSync(testsDir);
//     const tests = files.map((filename) => {
//       const filepath = path.join(testsDir, filename);
//       const data = fs.readFileSync(filepath, "utf8");
//       const test = JSON.parse(data);
//       return {
//         id: test.id,
//         name: test.name,
//         createdAt: test.createdAt,
//         questionCount: test.questions ? test.questions.length : 0,
//       };
//     });

//     res.json({
//       success: true,
//       tests: tests,
//     });
//   } catch (error) {
//     console.error("Ошибка получения списка тестов:", error);
//     res.status(500).json({
//       success: false,
//       error: "Ошибка получения списка тестов",
//     });
//   }
// });

// app.listen(3000, () => {
//   console.log("Сервер запущен на http://localhost:3000");
//   console.log(`Тесты сохраняются в папку: ${testsDir}`);
// });