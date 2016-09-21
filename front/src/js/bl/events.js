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
        STATED: 'ACCOUNT.STATED',//������ � ������������ ��������
        LOGOUT: 'ACCOUNT.LOGOUT',//������������ ������������
        VK: {
            AUTH: 'ACCOUNT.VK.AUTH',//����������� ���������
            LOGOUT: 'ACCOUNT.VK.LOGOUT',//����� �� ��
            INFO_READY: 'ACCOUNT.VK.INFO_READY',//������� � ���, ��� ������ ��������������� ������ �� ��
        },
        SHOW_PERIOD_FINISHED_MODAL: "ACCOUNT.SHOW_PERIOD_FINISHED_MODAL"
    },
    STAT: {
        MAIN: {
            FINISHED: 'STAT.MAIN.FINISHED',//������� � ���������� ����� �������� ����������
        },
        PUBLISH_ANALISYS: {
            FINISHED: 'PUBLISH_ANALISYS.MAIN.FINISHED',//������� � ���������� ����� ���������� ����������
        }
    }
};