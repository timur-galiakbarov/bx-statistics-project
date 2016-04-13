import events from './../../../bl/events.js';

angular
    .module('rad.dashboard')
    .controller('dashboardController', ['$rootScope', '$scope', 'bus', 'appState', 'radVkFactory', '$timeout',
        function ($rootScope, $scope, bus, appState, radVkFactory, $timeout) {

            $rootScope.page.sectionTitle = 'Главная';

            $(".nano").nanoScroller();
        }]);