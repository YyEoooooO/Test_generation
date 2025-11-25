document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('testForm');
    const resultDiv = document.getElementById('generationResult');
    const dynamicFields = document.getElementById('dynamicFields');
    const categorySelect = document.getElementById('category');

    // Функция для обновления динамических полей
    function updateDynamicFields() {
        const category = categorySelect.value;
        let html = '';

        if (category === 'programming') {
            html = `
                <div class="form-group">
                    <label for="programmingLanguage">Язык программирования:</label>
                    <select id="programmingLanguage" name="programmingLanguage" required>
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                        <option value="csharp">C#</option>
                        <option value="php">PHP</option>
                        <option value="ruby">Ruby</option>
                        <option value="go">Go</option>
                    </select>
                </div>
            `;
        } else if (category === 'math') {
            html = `
                <div class="form-group">
                    <label for="mathTopic">Раздел математики:</label>
                    <select id="mathTopic" name="mathTopic" required>
                        <option value="algebra">Алгебра</option>
                        <option value="geometry">Геометрия</option>
                        <option value="calculus">Математический анализ</option>
                        <option value="statistics">Теория вероятностей и статистика</option>
                        <option value="discrete">Дискретная математика</option>
                    </select>
                </div>
            `;
        } else if (category === 'science') {
            html = `
                <div class="form-group">
                    <label for="scienceField">Область науки:</label>
                    <select id="scienceField" name="scienceField" required>
                        <option value="physics">Физика</option>
                        <option value="chemistry">Химия</option>
                        <option value="biology">Биология</option>
                        <option value="astronomy">Астрономия</option>
                        <option value="geography">География</option>
                    </select>
                </div>
            `;
        } else if (category === 'language') {
            html = `
                <div class="form-group">
                    <label for="language">Язык:</label>
                    <select id="language" name="language" required>
                        <option value="english">Английский</option>
                        <option value="german">Немецкий</option>
                        <option value="french">Французский</option>
                        <option value="spanish">Испанский</option>
                        <option value="chinese">Китайский</option>
                        <option value="japanese">Японский</option>
                    </select>
                </div>
            `;
        } else if (category === 'other') {
            html = `
                <div class="form-group">
                    <label for="customTopic">Тема теста:</label>
                    <input type="text" id="customTopic" name="customTopic" placeholder="Введите тему теста" required>
                </div>
            `;
        }

        dynamicFields.innerHTML = html;
    }

    // Инициализация динамических полей при загрузке
    updateDynamicFields();

    // Обновление полей при изменении категории
    categorySelect.addEventListener('change', updateDynamicFields);
});