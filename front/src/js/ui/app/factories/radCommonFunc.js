import topics from './../../../bl/topics.js';
import events from './../../../bl/events.js';

(function (module, angular) {

    module.factory('radCommonFunc', radCommonFunc);

    radCommonFunc.$inject = ['$uibModal', 'bus', 'appState'];

    function radCommonFunc($uibModal, bus, appState) {

        var api = {
            getGroupId: function(url){
                /*todo проверить создание групп с началом public и group*/
                var vkGroupId = url.replace("https://vk.com/public", "");
                vkGroupId = vkGroupId.replace("https://vk.com/club", "");
                vkGroupId = vkGroupId.replace("https://vk.com/", "");

                vkGroupId = vkGroupId.replace("http://vk.com/public", "");
                vkGroupId = vkGroupId.replace("http://vk.com/club", "");
                vkGroupId = vkGroupId.replace("http://vk.com/", "");


                return vkGroupId;
            }
        };

        return api;

    }

})(angular.module("rad.ui.directives"), angular);