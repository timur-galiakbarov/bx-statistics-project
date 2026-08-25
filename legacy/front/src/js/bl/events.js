export default {
    APP: {
        READY: 'APP.READY',
    },
    POPUPS: {
        OPEN: {
            ADD: 'POPUP.ADD',
            EDIT: 'POPUP.EDIT'
        }
    },
    ACCOUNT: {
        STATED: 'ACCOUNT.STATED',
        LOGOUT: 'ACCOUNT.LOGOUT',
        VK: {
            AUTH: 'ACCOUNT.VK.AUTH',
            LOGOUT: 'ACCOUNT.VK.LOGOUT',
            INFO_READY: 'ACCOUNT.VK.INFO_READY',
        },
        SHOW_PERIOD_FINISHED_MODAL: "ACCOUNT.SHOW_PERIOD_FINISHED_MODAL",
        SHOW_NOT_SUBSCRIBE_MODAL: "ACCOUNT.SHOW_NOT_SUBSCRIBE_MODAL",//Показать модальное окно, что пользователь отписался от группы
        FREE_GROUP_ADDED: 'ACCOUNT.FREE_GROUP_ADDED', //Добавлена новая бесплатная группа
        ADD_FREE_GROUP_TO_LIST: 'ACCOUNT.ADD_FREE_GROUP_TO_LIST', //Сохранить в список новую добавленную группу
        STAT_LIST_UPDATED: 'ACCOUNT.STAT_LIST_UPDATED', //Обновился список групп статистики на главной
    },
    STAT: {
        MAIN: {
            RESIZE_GRAPH: 'STAT.MAIN.RESIZE_GRAPH'
        },
        PUBLISH_ANALISYS: {
            FINISHED: 'PUBLISH_ANALISYS.MAIN.FINISHED',
        },
        NEXT_PROGRESS: 'STAT.NEXT_PROGRESS'
    },
    ADMIN: {
        STATE_CHANGED: 'ADMIN.STATE_CHANGED'
    }
};