import topics from './bl/topics.js';
import events from './bl/events.js';
import ui from 'angular-ui-bootstrap';

/*Инициализация приложения*/
var app = angular.module('app', [
    'ngRoute',
    'ngSanitize',
    'ui.router',
    'rad.menu',
    'rad.stat',
    'rad.dashboard',
    'rad.account',
    'rad.favorites',
    'ui.bootstrap',
    'ui.bootstrap.tpls',
    'ui.mask'
]);

moment.locale('ru');

angular.module('app').run(['$rootScope', 'bus',
    function ($rootScope, bus) {

    }]);

app.controller('appController', ['$rootScope', '$scope', '$state', 'bus', 'notify',
    function ($rootScope, $scope, $state, bus, notify) {
        bus.subscribe(events.APP.READY, function () {
            $rootScope.$apply(function () {
                $rootScope.isAuth = true;
            });
            //Открываем раздел по умолчанию
            if ($state.current.name == 'index')
                goToDefaultState();
        });
        bus.request(topics.ACCOUNT.IS_AUTH, {notLogError: true}).then((res)=> {
            if (res.success) {

                bus.request(topics.ACCOUNT.GET_USER_INFO).then((res)=> {
                    bus.publish(events.ACCOUNT.STATED, res);
                });

            } else {
                $scope.isAuth = false;
                location.href = '/login/';
            }
        });

        bus.subscribe(events.ACCOUNT.LOGOUT, function () {
            bus.request(topics.ACCOUNT.LOGOUT).then((res)=> {
                location.href = '/login/';
            });
        });

        $rootScope.page = {
            sectionTitle: '',
            breadcrumb: []
        };

        $scope.toggleMenu = function (e) {
            var ul = $(".cl-vnavigation");
            ul.slideToggle(300, 'swing', function () {
            });
            e.preventDefault();
        };

        bus.subscribe(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL, ()=> {
            //Открыть попап для показа информации о просроченном периоде
            $("#finishedPeriodModal").modal();
        });

        $rootScope.$on('$stateChangeSuccess', function (evt, toState) {
            if (toState.name === 'index') {
                goToDefaultState();
            }
        });

        $rootScope.openState = function (state) {
            if ($rootScope.globalLoading) {
                notify.info("Пожалуйста, дождитесь загрузки данных, либо совершите действие в другой вкладке.");
                return;
            }

            $state.go(state);
        };

        function goToDefaultState() {
            $state.go('index.analytics');
        }

        function init() {
            VK.Observer.subscribe("widgets.subscribed", function f() {
                $("#vk_subscribe").html("");
            });

            VK.Observer.subscribe("widgets.groups.joined", function f() {
                $("#vk_subscribe").html("");
            });
        }

        init();

    }]);
