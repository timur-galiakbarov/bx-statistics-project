angular
    .module('rad.dashboard')
    .controller('dashboardController', ['$rootScope', '$scope', '$state',
        function($rootScope, $scope, $state) {

            $rootScope.page.sectionTitle = 'Главная';

            $(".nano").nanoScroller();
        }]);