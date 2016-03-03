import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.settings')
    .directive('radVkAuth', radVkAuth);

function radVkAuth() {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/settings/directives/radVkAuth/radVkAuth.html',
        controller: ['$scope', '$state', 'bus', '$timeout', function ($scope, $state, bus, $timeout) {

            $scope.logout = function () {
                bus.request(topics.ACCOUNT.LOGOUT_VK).then(function (res) {
                    if (res.success)
                        $scope.$apply(function(){
                            $scope.vkInfo.isAuth = false;
                        });
                });
            };

        }],
        link: link,
        scope: {
            vkInfo: '='
        }
    };
}

function link($scope) {

}