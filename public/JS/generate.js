// Обработка формы генерации теста
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('testForm');
    const resultDiv = document.getElementById('generationResult');
    
    // Обработка формы генерации теста
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const testData = {
            name: formData.get('testName'),
            questionCount: parseInt(formData.get('questionCount')),
            difficulty: formData.get('difficulty'),
            category: formData.get('category')
        };

        // Добавляем специфичные поля в зависимости от категории
        const category = testData.category;
        if (category === 'programming') {
            testData.specificField = formData.get('programmingLanguage');
        } else if (category === 'math') {
            testData.specificField = formData.get('mathTopic');
        } else if (category === 'science') {
            testData.specificField = formData.get('scienceField');
        } else if (category === 'language') {
            testData.specificField = formData.get('language');
        } else if (category === 'other') {
            testData.specificField = formData.get('customTopic');
        }
        
        try {
            const response = await fetch('/generate-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });
            
            const result = await response.json();
            if (result.success) {
                showResult('success', `Тест создан! ID: ${result.testId}`);
                localStorage.setItem('lastTestId', result.testId);
            } else {
                showResult('error', result.error);
            }
        } catch (error) {
            showResult('error', 'Ошибка соединения с сервером');
        }
    });
    
    function showResult(type, message) {
        resultDiv.textContent = message;
        resultDiv.className = `result-message ${type}`;
        resultDiv.style.display = 'block';
        
        // Автоматически скрыть сообщение через 5 секунд
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 50000);
    }
});