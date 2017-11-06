import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.ui.directives')
    .directive('radAdminLink', radAdminLink);

radAdminLink.$inject = ['appState', '$rootScope', '$state'];

function radAdminLink(appState, $rootScope, $state) {
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: './templates/js/ui/app/directives/radAdminLink/radAdminLink.html',
        controller: ['$scope', '$timeout', function ($scope, $timeout) {

        }],
        link: function ($scope, attrs) {

            $scope.isAdmin = appState.isAdmin();
        }
    };
}

