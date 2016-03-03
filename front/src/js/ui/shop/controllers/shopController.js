import {enums} from './../../../bl/module.js';

angular
    .module('rad.shop')
    .controller('shopController', ['$rootScope', '$scope', '$state', 'bus', 'shopPopupsFactory', 'appState',
    function($rootScope, $scope, $state, bus, shopPopupsFactory, appState) {
        $scope.currentTab = 'catalog';
        $rootScope.page.sectionTitle = 'Магазин';
        $scope.catalogPages = {
            publish: 'publish',
            catalog: 'catalog'
        };
        $scope.viewTab = function(tabName){
            $scope.currentTab = tabName;
        };

        //console.log(appState.getCurrentShop());

        /*Диалоговые окна*/
        $scope.popupAddItem = function(){//Открытие попапа добавленния нового товара
            shopPopupsFactory.openAddItemPopup();
        };

    }]);