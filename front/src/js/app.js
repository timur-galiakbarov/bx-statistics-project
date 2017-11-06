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

        $rootScope.tariffInfo = {
            activeTo: "",
            userName: ""
        };

        var mobile_menu_initialized;
        var toggle_initialized;

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
                    $rootScope.tariffInfo.activeTo = res.user.activeTo;
                    $rootScope.tariffInfo.userName = res.user.userFullName;
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
            sectionTitle: ''
        };

        $rootScope.setTitle = setTitle;
        $rootScope.toggleMenu = toggleMenu;

        bus.subscribe(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL, ()=> {
            //Открыть попап для показа информации о просроченном периоде
            $("#finishedPeriodModal").modal();
        });

        bus.subscribe(events.ACCOUNT.SHOW_NOT_SUBSCRIBE_MODAL, ()=> {
            //Открыть попап для показа информации, что пользователь вышел из группы
            $("#userUnsubscribedPopup").modal();
        });

        $rootScope.$on('$stateChangeSuccess', function (evt, toState) {
            if (toState.name === 'index') {
                goToDefaultState();
            }
        });

        $rootScope.openState = function (state) {
            if ($rootScope.globalLoading) {
                notify.info("Пожалуйста, дождитесь загрузки данных.");
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

        function setTitle(title) {
            $rootScope.page.sectionTitle = title;
        }

        function toggleMenu() {

            var $toggle = $(".navbar-toggle");

            if (mobile_menu_visible == 1) {
                $('html').removeClass('nav-open');

                $('.close-layer').remove();
                setTimeout(function() {
                    $toggle.removeClass('toggled');
                }, 400);

                mobile_menu_visible = 0;
            } else {
                setTimeout(function() {
                    $toggle.addClass('toggled');
                }, 430);

                var $layer = $('<div class="close-layer"></div>');

                if ($('body').find('.main-panel').length != 0) {
                    $layer.appendTo(".main-panel");

                } else if (($('body').hasClass('off-canvas-sidebar'))) {
                    $layer.appendTo(".wrapper-full-page");
                }

                setTimeout(function() {
                    $layer.addClass('visible');
                }, 100);

                $layer.click(function() {
                    $('html').removeClass('nav-open');
                    mobile_menu_visible = 0;

                    $layer.removeClass('visible');

                    setTimeout(function() {
                        $layer.remove();
                        $toggle.removeClass('toggled');

                    }, 400);
                });

                $('html').addClass('nav-open');
                mobile_menu_visible = 1;

            }
        }

        init();


    }]);