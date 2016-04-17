import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statPublishAnalisysController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState) {
            $scope.currentTab = 'catalog';
            $rootScope.page.sectionTitle = 'Анализ публикаций';


            $('.icheck').iCheck({
                checkboxClass: 'icheckbox_flat-blue',
                radioClass: 'iradio_flat-blue'
            });

        }]);