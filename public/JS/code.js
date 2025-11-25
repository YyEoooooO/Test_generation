document.addEventListener("DOMContentLoaded", function () {
  loadTests();
});

async function loadTests() {
  try {
    const response = await fetch("/tests");
    const data = await response.json();

    const testsContainer = document.getElementById("testsContainer");

    if (data.success && data.tests.length > 0) {
      testsContainer.innerHTML = "";

      data.tests.forEach((test) => {
        const testCard = document.createElement("div");
        testCard.className = "test-card";
        testCard.innerHTML = `
                    <h3>${test.name}</h3>
                    <p>ID: ${test.id}</p>
                    <p>Вопросов: ${test.questionCount}</p>
                    <p>Создан: ${new Date(
                      test.createdAt
                    ).toLocaleDateString()}</p>
                    <button class="start-test-btn" data-test-id="${
                      test.id
                    }">Начать тест</button>
                `;
        testsContainer.appendChild(testCard);
      });

      // Добавляем обработчики событий для кнопок
      document.querySelectorAll(".start-test-btn").forEach((button) => {
        button.addEventListener("click", function () {
          const testId = this.getAttribute("data-test-id");
          startTest(testId);
        });
      });
    } else {
      testsContainer.innerHTML = '<div class="no-tests">Тесты не найдены</div>';
    }
  } catch (error) {
    console.error("Ошибка загрузки тестов:", error);
    document.getElementById("testsContainer").innerHTML =
      '<div class="error">Ошибка загрузки тестов</div>';
  }
}

function startTest(testId) {
  // Переходим на страницу теста
  window.location.href = `test.html?testId=${testId}`;
}
