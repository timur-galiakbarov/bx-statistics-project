import topics from './../../../bl/topics.js';
import events from './../../../bl/events.js';

(function (module, angular) {

    module.factory('radVkFactory', radVkFactory);

    radVkFactory.$inject = ['$modal', 'bus', 'appState'];

    function radVkFactory($modal, bus, appState) {

        var getGroupsList = function (login, token) {
            var Q = $.Deferred(),
                model = {
                    groupsList: []
                },
                iteration = 0,
                maxIteration = 3;

            getScriptData();

            return Q.promise();

            function getScriptData() {
                if (iteration >= maxIteration) {
                    Q.reject();
                    return;
                }
                $.ajax({
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
                        if (res && res.response) {
                            res = res.response;

                            res.forEach(function (item) {
                                if (typeof item == "object")
                                    model.groupsList.push(item);
                            });

                            return Q.resolve(model);
                        } else {
                            errorProcess(res, getScriptData);
                        }
                    },
                    error: function (result_info) {
                        console.log(result_info);
                        errorProcess(res, getScriptData);
                    }
                });
                iteration++;
            }
        };

        var getGroupInfo = function () {

        };

        var getWallData = function () {

        };

        function errorProcess(res, callbackFunc){
            if (res && res.error)
                setTimeout(function () {//Через 0,5 секунды
                    callbackFunc();//Замыкаем рекурсивно функцию
                }, 500);
        }

        return {
            getGroupInfo: getGroupInfo,
            getWallData: getWallData,
            getGroupsList: getGroupsList
        }

    }

})(angular.module("app"), angular);