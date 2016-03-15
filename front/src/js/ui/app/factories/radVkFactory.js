import topics from './../../../bl/topics.js';
import events from './../../../bl/events.js';

(function (module, angular) {

    module.factory('radVkFactory', radVkFactory);

    radVkFactory.$inject = ['$modal', 'bus', 'appState'];

    function radVkFactory($modal, bus, appState) {

        var getGroupsList = function (login, token) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.get?access_token=" + token,
                dataType: 'jsonp',
                data: {
                    login: login,//Передаем логин Вк
                    token: token,//Токен
                    filter: 'admin,editor,moder',
                    extended: 1
                },
                success: function (res) {
                    return res;
                    /*if (res && res.response) {
                        iteration++;

                        model.subscribed += res.response.subscribed;
                        model.unsubscribed += res.response.unsubscribed;
                        model.views += res.response.views;
                        model.visitors += res.response.visitors;
                        model.subscribedSumm += res.response.subscribedSumm;
                        model.reachSubscribers += res.response.reachSubscribers;
                        model.reach += res.response.reach;

                        if (res.response.flagNext) {
                            flagNext = res.response.flagNext;
                            getVKScriptData();//Замыкаем рекурсивно функцию
                        } else {
                            Q.resolve(model);
                        }
                    } else {
                        if (res && res.error) {
                            setTimeout(function () {//Через 0,5 секунды
                                getVKScriptData();//Замыкаем рекурсивно функцию
                            }, 500);
                        } else {
                            Q.reject();
                        }
                    }*/
                },
                error: function (result_info) {
                    console.log(result_info);
                }
            });
        };

        var getGroupInfo = function () {

        };

        var getWallData = function () {

        };

        return {
            getGroupInfo: getGroupInfo,
            getWallData: getWallData,
            getGroupsList: getGroupsList
        }

    }

})(angular.module("app"), angular);