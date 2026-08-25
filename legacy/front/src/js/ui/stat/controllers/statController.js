import {enums} from './../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState',
    function($rootScope, $scope, $state, bus, statPopupsFactory, appState) {
        $scope.currentTab = 'catalog';
        $rootScope.page.sectionTitle = 'Статистика сообщества';
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
            statPopupsFactory.openAddItemPopup();
        };

    }]);