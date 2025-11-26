document.addEventListener("DOMContentLoaded", function () {
  // Инициализация вкладок
  initTabs();
  
  // Загружаем все тесты по умолчанию
  loadTests();
});

// Инициализация системы вкладок
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Убираем активный класс у всех кнопок и контента
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Добавляем активный класс текущей кнопке и контенту
      this.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
      
      // Загружаем контент для активной вкладки
      if (targetTab === 'all-tests') {
        loadTests();
      } else if (targetTab === 'my-tests') {
        loadUserTests();
      }
    });
  });
}

// Загрузка всех тестов
async function loadTests() {
  const testsContainer = document.getElementById("testsContainer");
  
  try {
    testsContainer.innerHTML = '<div class="loading">Загрузка тестов...</div>';
    
    const response = await fetch("/tests");
    const data = await response.json();

    if (data.success && data.tests.length > 0) {
      testsContainer.innerHTML = "";

      data.tests.forEach((test) => {
        const testCard = createTestCard(test, false);
        testsContainer.appendChild(testCard);
      });
    } else {
      testsContainer.innerHTML = '<div class="no-tests">Тесты не найдены</div>';
    }
  } catch (error) {
    console.error("Ошибка загрузки тестов:", error);
    testsContainer.innerHTML = '<div class="error">Ошибка загрузки тестов</div>';
  }
}

// Загрузка пользовательских тестов
async function loadUserTests() {
  const userTestsContainer = document.getElementById("userTestsContainer");
  
  try {
    userTestsContainer.innerHTML = '<div class="loading">Загрузка ваших тестов...</div>';
    
    // Получаем ID тестов из куки
    const userTestIds = CookieManager.getUserTests();
    
    if (userTestIds.length === 0) {
      userTestsContainer.innerHTML = '<div class="no-tests">Вы еще не создали тестов. <a href="generate.html">Создайте первый тест!</a></div>';
      return;
    }

    // Загружаем информацию о каждом тесте
    const userTests = [];
    for (const testId of userTestIds) {
      try {
        const response = await fetch(`/test/${testId}`);
        if (response.ok) {
          const testData = await response.json();
          if (testData.success) {
            userTests.push(testData.test);
          }
        }
      } catch (error) {
        console.error(`Ошибка загрузки теста ${testId}:`, error);
      }
    }

    if (userTests.length > 0) {
      userTestsContainer.innerHTML = "";
      
      userTests.forEach((test) => {
        const testCard = createTestCard(test, true);
        userTestsContainer.appendChild(testCard);
      });
    } else {
      userTestsContainer.innerHTML = '<div class="no-tests">Не удалось загрузить ваши тесты</div>';
    }
  } catch (error) {
    console.error("Ошибка загрузки пользовательских тестов:", error);
    userTestsContainer.innerHTML = '<div class="error">Ошибка загрузки ваших тестов</div>';
  }
}

// Создание карточки теста
function createTestCard(test, isUserTest) {
  const testCard = document.createElement("div");
  testCard.className = `test-card ${isUserTest ? 'user-test-card' : ''}`;
  
  testCard.innerHTML = `
    <h3>${test.name}</h3>
    <p><strong>ID:</strong> ${test.id}</p>
    <p><strong>Вопросов:</strong> ${test.questionCount}</p>
    <p><strong>Сложность:</strong> ${getDifficultyText(test.difficulty)}</p>
    <p><strong>Категория:</strong> ${getCategoryText(test.category)}</p>
    <p><strong>Создан:</strong> ${new Date(test.createdAt).toLocaleDateString()}</p>
    <div class="test-actions">
      <button class="start-test-btn" data-test-id="${test.id}">Начать тест</button>
      ${isUserTest ? `<button class="delete-test-btn" data-test-id="${test.id}">Удалить</button>` : ''}
    </div>
  `;

  // Обработчик для кнопки начала теста
  const startButton = testCard.querySelector('.start-test-btn');
  startButton.addEventListener('click', function() {
    const testId = this.getAttribute('data-test-id');
    startTest(testId);
  });

  // Обработчик для кнопки удаления (только для пользовательских тестов)
  if (isUserTest) {
    const deleteButton = testCard.querySelector('.delete-test-btn');
    deleteButton.addEventListener('click', function() {
      const testId = this.getAttribute('data-test-id');
      deleteUserTest(testId);
    });
  }

  return testCard;
}

// Функция для удаления теста из пользовательских
function deleteUserTest(testId) {
  if (confirm("Вы уверены, что хотите удалить этот тест из списка?")) {
    CookieManager.removeTestId(testId);
    // Перезагружаем вкладку пользовательских тестов
    loadUserTests();
  }
}

function startTest(testId) {
  window.location.href = `test.html?testId=${testId}`;
}

// Вспомогательные функции для отображения
function getDifficultyText(difficulty) {
  const difficulties = {
    'easy': 'Легкий',
    'medium': 'Средний',
    'hard': 'Сложный'
  };
  return difficulties[difficulty] || difficulty;
}

function getCategoryText(category) {
  const categories = {
    'programming': 'Программирование',
    'math': 'Математика',
    'science': 'Наука',
    'language': 'Языки',
    'other': 'Другое'
  };
  return categories[category] || category;
}