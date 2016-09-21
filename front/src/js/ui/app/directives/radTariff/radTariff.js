import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.ui.directives')
    .directive('radTariff', radTariff);

radTariff.$inject = ['appState'];

function radTariff(appState) {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/app/directives/radTariff/radTariff.html',
        controller: ['$scope', '$timeout', function ($scope, $timeout) {

        }],
        scope:{
            view: '=?'
        },
        link: function ($scope, attrs) {

            var userData = appState.user();
            $scope.model = {
                userId: userData.id,
                tariff: userData.tariff,
                activeTo: userData.activeTo,
                userFullName: userData.userFullName
            };
            $scope.paymentInfo = {
                period: '1 месяц',
                summ: '199'
            };
            $scope.noActiveTariff = !appState.isActiveUser();

            $scope.$watch('paymentInfo.period', (newVal)=> {
                switch (newVal){
                    case '1 месяц':
                        $scope.paymentInfo.summ = 199;
                        break;
                    case '3 месяца':
                        $scope.paymentInfo.summ = 499;
                        break;
                    case '6 месяцев':
                        $scope.paymentInfo.summ = 899;
                        break;
                }
            });
        }
    };
}

