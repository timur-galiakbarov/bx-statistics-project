export default {
    ACCOUNT: {
        IS_AUTH: 'ACCOUNT.IS_AUTH',
        GET_USER_INFO: 'ACCOUNT.GET_USER_INFO',
        LOGOUT: 'ACCOUNT.LOGOUT_SYSTEM',
        GET_VK_INFO: 'ACCOUNT.GET_VK_INFO',//��������� ������ �� ����������� ���������
        LOGOUT_VK: 'ACCOUNT.LOGOUT_VK',//����� �� ���� ���������
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
    }
};