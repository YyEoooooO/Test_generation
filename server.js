// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { randomInt } = require('crypto');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Создаем папку для тестов, если её нет
const testsDir = path.join(__dirname, 'tests');
if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir);
}

function parse_ai_response_to_json(aiResponse, testData) {
    try {
        // Разбиваем ответ на отдельные вопросы
        const questionBlocks = aiResponse.split(/\n\s*\n/).filter(block => block.trim());
        
        const questions = [];
        
        for (const block of questionBlocks) {
            const lines = block.split('\n').map(line => line.trim()).filter(line => line);
            const questionData = {};
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.startsWith('Вопрос:')) {
                    questionData.question = line.replace('Вопрос:', '').trim();
                }
                else if (line.startsWith('Варианты:')) {
                    const options = [];
                    // Собираем следующие 3 строки как варианты ответов
                    for (let j = 1; j <= 3; j++) {
                        if (i + j < lines.length) {
                            const optionLine = lines[i + j];
                            // Убираем нумерацию "1.", "2." и т.д.
                            const optionText = optionLine.replace(/^\d+\.\s*/, '');
                            if (optionText && !optionText.startsWith('Правильный ответ:')) {
                                options.push(optionText);
                            }
                        }
                    }
                    questionData.options = options;
                }
                else if (line.startsWith('Правильный ответ:')) {
                    const correctAnswer = line.replace('Правильный ответ:', '').trim();
                    try {
                        // Преобразуем в 0-based индекс для JSON
                        questionData.correctAnswer = parseInt(correctAnswer) - 1;
                        // Проверяем, что индекс в пределах допустимого
                        if (questionData.correctAnswer < 0 || questionData.correctAnswer > 2) {
                            questionData.correctAnswer = 0;
                        }
                    } catch (error) {
                        questionData.correctAnswer = 0;
                    }
                }
            }
            
            // Проверяем, что все необходимые поля есть и options содержит 3 варианта
            if (questionData.question && 
                questionData.options && 
                questionData.options.length === 3 && 
                typeof questionData.correctAnswer === 'number') {
                questions.push(questionData);
            }
        }
        
        // Создаем структуру теста
        const testStructure = {
            id: randomInt(100000, 999999),
            name: testData.testName || `Тест по ${testData.specificField}`,
            questions: questions,
            topic: testData.specificField,
            difficulty: testData.difficulty,
            createdAt: new Date().toISOString()
        };
        
        return testStructure;
        
    } catch (error) {
        console.error('Ошибка парсинга ответа AI:', error);
        // Возвращаем тест с ошибкой, чтобы не ломать приложение
        return {
            id: randomInt(100000, 999999),
            name: 'Ошибка парсинга',
            questions: [],
            topic: testData.specificField,
            difficulty: testData.difficulty,
            createdAt: new Date().toISOString()
        };
    }
}

async function generateWithAI(testData) 
{
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer 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", // API-ключ
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Test Generator Server",     
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "deepseek/deepseek-chat",
                "messages": [
                    {
                        "role": "user",
                        "content": `Сгенерируй тест по западной тематике со следующими параметрами:\n- Количество вопросов: ${testData.questionCount}\n- Сложность: ${testData.difficulty}\n- Категория: ${testData.category}\n- Тема: {${testData.specificField}}\n\nФормат каждого вопроса:\nВопрос: [текст вопроса]\Варианты:\n1. [вариант 1]\n2. [вариант 2]\n3. [вариант 3]\nПравильный ответ: [номер правильного варианта]\n\nСгенерируй вопросы в соответствии с категорией и темой. Каждый вопрос должен иметь 3 варианта ответа. Правильный ответ указывай цифрой от 1 до 3. Разделяй вопросы пустой строкой.`
                    }
                ]
            })
        });

        console.log("111");
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        // Извлекаем ответ ИИ
        const aiResponse = data.choices[0]?.message?.content || "Ответ не получен";
        // djn nde dsjn 
        return parse_ai_response_to_json(aiResponse, testData);

    } catch (error) {
        console.error('Ошибка:', error);
        return {
            id: randomInt(100000, 999999),
            name: 'Ошибка генерации',
            questions: [],
            topic: testData.specificField,
            difficulty: testData.difficulty,
            createdAt: new Date().toISOString()
        };
    } 
}

app.post('/generate-test', async (req, res) => {
    try {
        console.log("Получены данные:", req.body);
        
        // Генерируем тест
        const test = await generateWithAI(req.body);
        
        // Сохраняем тест в файл
        const filename = `test_${test.id}.json`;
        const filepath = path.join(testsDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(test, null, 2));
        console.log(`Тест сохранен в файл: ${filename}`);
        
        // Отправляем только ID созданного теста
        res.json({ 
            success: true, 
            testId: test.id,
            message: "Тест успешно создан и сохранен"
        });
        
    } catch (error) {
        console.error('Ошибка генерации теста:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка генерации теста' 
        });
    }
});

// Endpoint для получения теста по ID
app.get('/test/:testId', (req, res) => {
    try {
        const testId = req.params.testId;
        const filename = `test_${testId}.json`;
        const filepath = path.join(testsDir, filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ 
                success: false,
                error: 'Тест не найден' 
            });
        }
        
        const testData = fs.readFileSync(filepath, 'utf8');
        const test = JSON.parse(testData);
        
        res.json({
            success: true,
            test: test
        });
        
    } catch (error) {
        console.error('Ошибка загрузки теста:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка загрузки теста' 
        });
    }
});

// Endpoint для получения списка всех тестов
app.get('/tests', (req, res) => {
    try {
        const files = fs.readdirSync(testsDir);
        const tests = files.map(filename => {
            const filepath = path.join(testsDir, filename);
            const data = fs.readFileSync(filepath, 'utf8');
            const test = JSON.parse(data);
            return {
                id: test.id,
                name: test.name,
                createdAt: test.createdAt,
                questionCount: test.questions ? test.questions.length : 0
            };
        });
        
        res.json({
            success: true,
            tests: tests
        });
        
    } catch (error) {
        console.error('Ошибка получения списка тестов:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка получения списка тестов' 
        });
    }
});

app.listen(3000, () => {
    console.log('Сервер запущен на http://localhost:3000');
    console.log(`Тесты сохраняются в папку: ${testsDir}`);
});