export default {
    APP: {
        READY: 'APP.READY'
    },
    POPUPS: {
        OPEN: {
            ADD: 'POPUP.ADD',
            EDIT: 'POPUP.EDIT'
        }
    },
    ACCOUNT: {
        STATED: 'ACCOUNT.STATED',//Данные о пользователе получены
        LOGOUT: 'ACCOUNT.LOGOUT',//Пользователь разлогинился
        VK: {
            AUTH: 'ACCOUNT.VK.AUTH',//Авторизация Вконтакте
            LOGOUT: 'ACCOUNT.VK.LOGOUT',//Выход из ВК
            INFO_READY: 'ACCOUNT.VK.INFO_READY',//Событие о том, что пришли данные от ВК
        }
    },
    SHOP: {
        ITEM_CREATED: 'SHOP.ITEM.CREATED',//Событие о созданном в БД товаре
        ITEM_REMOVED: 'SHOP.ITEM.REMOVED',//Событие о удаленном в БД товаре
    }
};