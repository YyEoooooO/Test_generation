class TestRunner {
    constructor() {
        this.testId = null;
        this.testData = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.isTestCompleted = false;
        
        this.initializeElements();
        this.initializeEventListeners();
        this.loadTestFromURL();
    }

    initializeElements() {
        // Основные элементы
        this.testTitle = document.getElementById('testTitle');
        this.testContent = document.getElementById('testContent');
        this.questionCounter = document.getElementById('questionCounter');
        this.progressFill = document.getElementById('progressFill');
        
        // Кнопки навигации
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.submitBtn = document.getElementById('submitBtn');
        
        // Модальное окно результатов
        this.resultsModal = document.getElementById('resultsModal');
        this.resultsContent = document.getElementById('resultsContent');
        this.closeResults = document.getElementById('closeResults');
    }

    initializeEventListeners() {
        this.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.submitBtn.addEventListener('click', () => this.submitTest());
        this.closeResults.addEventListener('click', () => this.closeResultsModal());
        
        // Закрытие модального окна при клике вне его
        this.resultsModal.addEventListener('click', (e) => {
            if (e.target === this.resultsModal) {
                this.closeResultsModal();
            }
        });
    }

    async loadTestFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        this.testId = urlParams.get('testId');
        
        if (!this.testId) {
            this.showError('ID теста не указан');
            return;
        }

        await this.loadTestData();
    }

    async loadTestData() {
        try {
            this.showLoading();
            
            const response = await fetch(`/test/${this.testId}`);
            const data = await response.json();
            
            if (data.success) {
                this.testData = data.test;
                this.userAnswers = new Array(this.testData.questions.length).fill(null);
                this.initializeTest();
            } else {
                throw new Error(data.error || 'Ошибка загрузки теста');
            }
        } catch (error) {
            console.error('Ошибка загрузки теста:', error);
            this.showError('Не удалось загрузить тест. Проверьте ID теста.');
        }
    }

    initializeTest() {
        this.testTitle.textContent = this.testData.name;
        this.displayQuestion(0);
        this.updateNavigation();
    }

    displayQuestion(questionIndex) {
        if (!this.testData || !this.testData.questions[questionIndex]) {
            return;
        }

        const question = this.testData.questions[questionIndex];
        
        let questionHTML = `
            <div class="question-card">
                <h3 class="question-text">${question.question}</h3>
                <div class="options-container">
        `;

        question.options.forEach((option, index) => {
            const isChecked = this.userAnswers[questionIndex] === index;
            questionHTML += `
                <label class="option-label ${isChecked ? 'selected' : ''}">
                    <input type="radio" name="answer" value="${index}" 
                           ${isChecked ? 'checked' : ''}>
                    <span class="option-text">${option}</span>
                </label>
            `;
        });

        questionHTML += `
                </div>
            </div>
        `;

        this.testContent.innerHTML = questionHTML;
        this.currentQuestionIndex = questionIndex;
        
        // Обновляем счетчик и прогресс
        this.updateProgress();
        this.updateNavigation();
        this.setupOptionListeners();
    }

    setupOptionListeners() {
        const optionInputs = this.testContent.querySelectorAll('input[name="answer"]');
        optionInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.userAnswers[this.currentQuestionIndex] = parseInt(e.target.value);
                
                // Обновляем визуальное выделение
                const labels = this.testContent.querySelectorAll('.option-label');
                labels.forEach(label => label.classList.remove('selected'));
                e.target.closest('.option-label').classList.add('selected');
                
                this.updateNavigation();
            });
        });
    }

    updateProgress() {
        const progress = ((this.currentQuestionIndex + 1) / this.testData.questions.length) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.questionCounter.textContent = 
            `Вопрос ${this.currentQuestionIndex + 1} из ${this.testData.questions.length}`;
    }

    updateNavigation() {
        // Кнопка "Назад"
        this.prevBtn.disabled = this.currentQuestionIndex === 0;
        
        // Кнопка "Далее" / "Завершить"
        const hasAnswer = this.userAnswers[this.currentQuestionIndex] !== null;
        const isLastQuestion = this.currentQuestionIndex === this.testData.questions.length - 1;
        
        this.nextBtn.style.display = isLastQuestion ? 'none' : 'block';
        this.submitBtn.style.display = isLastQuestion && hasAnswer ? 'block' : 'none';
        this.nextBtn.disabled = !hasAnswer;
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.displayQuestion(this.currentQuestionIndex - 1);
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.testData.questions.length - 1) {
            this.displayQuestion(this.currentQuestionIndex + 1);
        }
    }

    submitTest() {
        if (this.isTestCompleted) return;
        
        this.isTestCompleted = true;
        this.calculateResults();
        this.showResults();
    }

    calculateResults() {
        let correctAnswers = 0;
        
        this.testData.questions.forEach((question, index) => {
            if (this.userAnswers[index] === question.correctAnswer) {
                correctAnswers++;
            }
        });
        
        this.results = {
            total: this.testData.questions.length,
            correct: correctAnswers,
            percentage: Math.round((correctAnswers / this.testData.questions.length) * 100)
        };
    }

    showResults() {
        let resultsHTML = `
            <div class="results-summary">
                <div class="score">${this.results.percentage}%</div>
                <p>Правильных ответов: ${this.results.correct} из ${this.results.total}</p>
            </div>
            <div class="detailed-results">
                <h3>Детальные результаты:</h3>
        `;

        this.testData.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const isCorrect = userAnswer === question.correctAnswer;
            const userAnswerText = userAnswer !== null ? question.options[userAnswer] : 'Не отвечено';
            const correctAnswerText = question.options[question.correctAnswer];
            
            resultsHTML += `
                <div class="question-result ${isCorrect ? 'correct' : 'incorrect'}">
                    <h4>Вопрос ${index + 1}: ${question.question}</h4>
                    <p>Ваш ответ: ${userAnswerText}</p>
                    ${!isCorrect ? `<p>Правильный ответ: ${correctAnswerText}</p>` : ''}
                </div>
            `;
        });

        resultsHTML += `</div>`;
        this.resultsContent.innerHTML = resultsHTML;
        this.resultsModal.style.display = 'block';
    }

    closeResultsModal() {
        this.resultsModal.style.display = 'none';
        // Перенаправляем на главную страницу при закрытии модального окна
        window.location.href = 'index.html';
    }

    showLoading() {
        this.testContent.innerHTML = '<div class="loading">Загрузка теста...</div>';
    }

    showError(message) {
        this.testContent.innerHTML = `
            <div class="error-message">
                <h3>Ошибка</h3>
                <p>${message}</p>
                <button onclick="window.location.href='index.html'" class="nav-btn">
                    Вернуться на главную
                </button>
            </div>
        `;
    }
}

// Инициализация теста при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new TestRunner();
});