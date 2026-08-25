export default {
    ACCOUNT: {
        IS_AUTH: 'ACCOUNT.IS_AUTH',
        GET_USER_INFO: 'ACCOUNT.GET_USER_INFO',
        LOGOUT: 'ACCOUNT.LOGOUT_SYSTEM',
        GET_VK_INFO: 'ACCOUNT.GET_VK_INFO',
        LOGOUT_VK: 'ACCOUNT.LOGOUT_VK',
        GET_FREE_GROUPS: 'ACCOUNT.GET_FREE_GROUPS',
        ADD_FREE_GROUP: 'ACCOUNT.ADD_FREE_GROUP',//Добавить группу в список бесплатных
        SAVE_STAT_LIST: 'ACCOUNT.SAVE_STAT_LIST',//Сохранить список групп для статистики на главной
    },
    GET_CONTENT: {
        GET_LIST: 'GET_CONTENT.GET_LIST'//получение списка разделов для поиска контента
    },
    NEWS: {
        GET_LIST: 'NEWS.GET_LIST'//Получить список новостей
    },
    BOOKMARK: {
        ADD: 'BOOKMARK.ADD',//Добавить группу в закладки
        GET_LIST: 'BOOKMARK.GET_LIST', //Список закладок
        REMOVE: 'BOOKMARK.REMOVE' //Удалить закладку
    },
    FAVORITE: {
        ADD: 'FAVORITE.ADD',//Добавить в любимые
        GET_LIST: 'FAVORITE.GET_LIST', //Получить Список любимых постов
        REMOVE: 'FAVORITE.REMOVE' //Удалить закладку
    },
    REPORTS: {
        GET_BANNED_LIST: 'REPORTS.GET_BANNED_LIST', //Получить XLSX отчет для мертвых участников
        GET_COMPARE_LIST: 'REPORTS.GET_COMPARE_LIST', //Получить XLSX отчет для сравнения аудитории
        GET_FIND_ANALOG_LIST: 'REPORTS.GET_FIND_ANALOG_LIST',
    },
    ADMIN: {
        GET_STAT: 'ADMIN.GET_STAT' //Общая админская статистика
    },
    STAT: {
        GET_WALL: 'STAT.GET_WALL',//Получить список записей со стены по параметрам
        GET_GROUP_STAT: 'STAT.GET_GROUP_STAT',//Получить статистику группы по параметрам
        GET_PHOTO: 'STAT.GET_PHOTO',//Получить список фотографий по параметрам
        GET_PHOTO_COMMENTS: 'STAT.GET_PHOTO_COMMENTS',//Получить список комментариев ко всем фото по параметрам
        GET_VIDEO: 'STAT.GET_VIDEO',//Получить список ведозаписей по параметрам
    },
    VK: {//Методы для работы с API ВКонтакте
        GET_WALL: 'VK.GET_WALL',
        GET_STAT: 'VK.GET_STAT',
        GET_ALL_PHOTO: 'VK.GET_ALL_PHOTO',
        GET_PHOTO_COMMENTS: 'VK.GET_PHOTO_COMMENTS',
        GET_VIDEO: 'VK.GET_VIDEO',
        GET_GROUP_INFO: 'VK.GET_GROUP_INFO',
        USERS_GET: 'VK.USERS_GET',
        IS_MEMBER: 'VK.IS_MEMBER'
    }
};