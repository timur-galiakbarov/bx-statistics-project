import topics from './../../../../bl/topics.js';
import events from './../../../../bl/events.js';

(function (module, angular) {

    module.factory('vkApiFactory', vkApiFactory);

    vkApiFactory.$inject = ['bus', 'appState'];

    function vkApiFactory(bus, appState) {

        var config = {
            appId: "5358505"
        };

        var getGroupInfo = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.getById?access_token=" + authData.token,
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    group_id: params.groupId,//Список групп
                    fields: ["members_count", "counters"]
                }
            }).then(function (res) {
                return res.response[0];
            });

        };

        var getStat = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/stats.get",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    group_id: params.groupId,//Список групп
                    date_from: params.dateFrom,
                    date_to: params.dateTo
                }
            }).then(function (res) {
                return res.response;
            });
        };

        var getWall = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/wall.get",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: "-" + params.groupId,//Список групп
                    offset: params.offset,
                    count: params.count
                }
            }).then(function (res) {
                return res.response;
            });
        };

        var getUserGroups = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.get",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    user_id: authData.login,
                    extended: params.extended,
                    filter: params.filter,
                    fields: params.fields,
                    count: params.count
                }
            }).then(function (res) {
                return res.response;
            });
        };

        return {
            getGroupInfo: getGroupInfo,
            getStat: getStat,
            getWall: getWall,
            getUserGroups: getUserGroups
        }

    }

})(angular.module("rad.stat"), angular);