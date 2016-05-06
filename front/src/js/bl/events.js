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
            INFO_READY: 'ACCOUNT.VK.INFO_READY',//Событие о том, что пришли авторизационные данные от ВК
        }
    },
    STAT: {
        MAIN: {
            FINISHED: 'STAT.MAIN.FINISHED',//Событие о завершении сбора основной статистики
        }
    }
};