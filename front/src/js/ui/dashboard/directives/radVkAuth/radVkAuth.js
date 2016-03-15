import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.dashboard')
    .directive('radVkAuth', radVkAuth);

function radVkAuth() {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/dashboard/directives/radVkAuth/radVkAuth.html',
        controller: ['$scope', '$state', 'bus', '$timeout', function ($scope, $state, bus, $timeout) {

            $scope.logout = function () {
                bus.request(topics.ACCOUNT.LOGOUT_VK).then(function (res) {
                    if (res.success)
                        bus.publish(events.ACCOUNT.VK.LOGOUT);
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