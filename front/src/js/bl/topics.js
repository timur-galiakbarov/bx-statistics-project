export default {
    ACCOUNT: {
        IS_AUTH: 'ACCOUNT.IS_AUTH',
        GET_USER_INFO: 'ACCOUNT.GET_USER_INFO',
        LOGOUT: 'ACCOUNT.LOGOUT_SYSTEM',
        GET_VK_INFO: 'ACCOUNT.GET_VK_INFO',//Запросить данные об авторизации Вконтакте
        LOGOUT_VK: 'ACCOUNT.LOGOUT_VK',//Выйти из сети Вконтакте
    },
    SHOP: {
        GET_ITEMS: 'SHOP.GET_ITEMS',//Получение списка товаров
        ADD_ITEM: 'SHOP.ADD_ITEM',//Добавление товара в БД
        GET_ITEM: 'SHOP.GET_ITEM',//Получение товара по id
        REMOVE_ITEM: 'SHOP.REMOVE_ITEM',//Удаление товара из БД
    }
};