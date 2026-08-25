import events from './../../../bl/events.js';
import topics from './../../../bl/topics.js';

(function (module, angular) {

    module.factory('permissionService', permissionService);

    permissionService.$inject = ['appState', 'bus'];

    function permissionService(appState, bus) {
        return {
            canUseAnalytics: (options)=> {
                var deferr = $.Deferred();
                if (appState.isActiveUser()) {
                    deferr.resolve({success: true});
                    return deferr.promise();
                }

                var aviableGroups = appState.getFreeGroups();
                var freeGroups = aviableGroups.free;
                var freeGroupsWithSubscribeVk = aviableGroups.freeWithSubscribedVK;
                var authData = {
                    token: appState.getUserVkToken(),
                    login: appState.getUserVkLogin()
                };

                bus.request(topics.VK.GET_GROUP_INFO, authData, {
                    groupId: options.gid,
                    fields: "photo_big,photo_medium,photo,members_count,counters,description"
                }).then(function (res) {

                    if (freeGroups.indexOf(res.screen_name) >= 0 || freeGroups.indexOf(res.gid) >= 0) {
                        deferr.resolve({success: true});
                    } else if (freeGroupsWithSubscribeVk.indexOf(res.screen_name) >= 0 || freeGroupsWithSubscribeVk.indexOf(res.gid) >= 0) {
                        //Проверяем действительно ли текущий пользователь подписан на нашу группу socstat.ru
                        bus.request(topics.VK.IS_MEMBER, authData, {
                            group_id: "125792332",
                            user_id: appState.getUserVkLogin()
                        })
                            .then((res)=> {
                                if (res == 1){
                                    deferr.resolve({success: true});
                                } else {
                                    deferr.resolve({success: false, error: "notSubscribeVk"});
                                }
                            });
                    } else {
                        deferr.resolve({success: false, error: ""});
                    }
                });

                return deferr.promise();
            }
        }
    }

})(angular.module("rad.stat"), angular);