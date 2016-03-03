angular
    .module('rad.orders')
    .controller('ordersController', ['$rootScope', '$scope', '$state',
        function($rootScope, $scope, $state) {

            $rootScope.page.sectionTitle = 'Заказы';

            $(".nano").nanoScroller();
        }]);