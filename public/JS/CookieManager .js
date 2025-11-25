// Функции для работы с cookies
class CookieManager {
    // Получить cookie по имени
    static get(name) {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [cookieName, cookieValue] = cookie.trim().split('=');
            if (cookieName === name) {
                return decodeURIComponent(cookieValue);
            }
        }
        return null;
    }

    // Установить cookie
    static set(name, value, days = 365) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
    }

    // Добавить testId в список созданных тестов
    static addTestId(testId) {
        const currentTests = this.getUserTests();
        if (!currentTests.includes(testId)) {
            currentTests.push(testId);
            this.set('userGeneratedTests', JSON.stringify(currentTests));
        }
    }

    // Получить массив ID созданных тестов
    static getUserTests() {
        const testsJson = this.get('userGeneratedTests');
        return testsJson ? JSON.parse(testsJson) : [];
    }

    // Удалить testId из списка
    static removeTestId(testId) {
        const currentTests = this.getUserTests();
        const updatedTests = currentTests.filter(id => id !== testId);
        this.set('userGeneratedTests', JSON.stringify(updatedTests));
    }
}