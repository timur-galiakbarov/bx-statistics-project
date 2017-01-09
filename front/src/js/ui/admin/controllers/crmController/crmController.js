import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('crmController', ['$rootScope', '$scope', '$state', 'bus', 'vkApiFactory', 'appState', '$timeout',
        function ($rootScope, $scope, $state, bus, vkApiFactory, appState, $timeout) {
            $rootScope.page.sectionTitle = 'Dashboard';
            bus.publish(events.ADMIN.STATE_CHANGED, "crm");

            $scope.allSocialDOM = {
                text: ""
            };
            $scope.parse = {
                links: function () {
                    /*var obj = $("#hiddenDOM");
                     obj.html("");
                     obj.html($scope.allSocialDOM.text);

                     var links = obj.find("a[href*='vk.com']");
                     links.each((i)=>{
                     var link = $(links[i]).attr("href");
                     $("#adminList").append(link.replace("http://vk.com/id",""));
                     $("#adminList").append("\n");
                     console.log(link.replace("http://vk.com/id",""));
                     })*/
                    var obj = $($scope.allSocialDOM.text);

                    var links = obj.find("a[href*='vk.com']");
                    links.each((i)=> {
                        var link = $(links[i]).attr("href");
                        $("#adminList").append(link.replace("http://vk.com/id", ""));
                        $("#adminList").append("\n");
                        console.log(link.replace("http://vk.com/id", ""));
                    })
                }
            };

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            function init() {

            }

            init();

        }]);