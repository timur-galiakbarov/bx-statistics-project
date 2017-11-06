import {bus} from 'core';
import events from '../events.js';
import topics from '../topics.js';

var userInfo = null;

bus.subscribe(events.ACCOUNT.STATED, saveUserProfile);
bus.subscribe(events.ACCOUNT.VK.AUTH, saveVkAuthInfo);
bus.subscribe(events.ACCOUNT.ADD_FREE_GROUP_TO_LIST, addFreeGroupToList);

function saveUserProfile(user) {
    userInfo = user.user ? user.user : null;

    var authData = {
        login: userInfo.loginVk,
        token: userInfo.tokenVk
    };

    getVkUserInfo(authData);

    $.when(
        bus.request(topics.ACCOUNT.GET_FREE_GROUPS)
            .then((data)=> {
                userInfo.freeGroups = {
                    free: data.free || [],
                    freeWithSubscribedVK: data.freeWithSubscribedVK || []
                };
                return data;
            }),
        bus.request(topics.VK.IS_MEMBER, authData, {
            group_id: "125792332",
            user_id: userInfo.loginVk
        })
            .then((res)=> {
                userInfo.isSubscribed = res;
                return res;
            })
    )
        .then(()=> {
            bus.publish(events.APP.READY);
        });
}

function getVkUserInfo(authData) {
    bus.request(topics.VK.USERS_GET, authData, {
        user_ids: undefined,
        fields: "photo_200,photo_100"
    }).then((res)=> {
        userInfo.vkUserInfo = res;
    }).fail(()=> {
        notify.error("Не удалось получить данные по профилю ВКонтакте")
    });
}

function addFreeGroupToList(res) {
    if (res.source == "free") {
        if (!(userInfo.freeGroups && userInfo.freeGroups.free && userInfo.freeGroups.free.length)){
            userInfo.freeGroups.free = [res.group.screen_name];
        } else {
            userInfo.freeGroups.free.push(res.group.screen_name);
        }
    }
    if (res.source == "bySubscribe") {
        if (!(userInfo.freeGroups && userInfo.freeGroups.freeWithSubscribedVK && userInfo.freeGroups.freeWithSubscribedVK.length)){
            userInfo.freeGroups.freeWithSubscribedVK = [res.group.screen_name];
        } else {
            userInfo.freeGroups.freeWithSubscribedVK.push(res.group.screen_name);
        }
    }

    bus.publish(events.ACCOUNT.FREE_GROUP_ADDED, userInfo.freeGroups);
}

function saveVkAuthInfo(vkInfo) {
    userInfo.vkInfo = vkInfo || {};

    bus.publish(events.ACCOUNT.VK.INFO_READY);
}

var appState = {
    getUserId() {
        return userInfo ? userInfo.id : null;
    },
    getUserName() {
        return userInfo ? userInfo.userName : null;
    },
    getLastName() {
        return userInfo ? userInfo.userLastName : null;
    },
    getUserFullName() {
        return userInfo ? userInfo.userFullName : null;
    },
    getUserVkToken() {
        return userInfo ? userInfo.tokenVk : null;
    },
    getUserVkLogin() {
        return userInfo ? userInfo.loginVk : null;
    },
    getUserVkInfo() {
        return userInfo.vkUserInfo || "";
    },
    user() {
        return userInfo
    },
    getFreeGroups() {
        return userInfo ? userInfo.freeGroups : [];
    },
    getMainStat(){
        return mainStat ? mainStat : ''
    },
    isActiveUser(){//Действует ли безлимитная подписка
        return userInfo.isActiveUser;
    },
    isAdmin(){
        return userInfo ? userInfo.admin : false;
    },
    getAuthData() {
        return {
            token: this.getUserVkToken(),
            login: this.getUserVkLogin()
        }
    },
    groupIsFree(item) {
        var freeList = this.getFreeGroups();
        var freeArr = _.clone(freeList.free || []);
        (freeList.freeWithSubscribedVK || []).forEach((item)=> {
            freeArr.push(item);
        });

        return freeArr.indexOf(item.screen_name) >= 0;
    },
    isUserSubscribed(){
        return userInfo ? userInfo.isSubscribed : false;
    }
};

(function (module) {
    module.factory('appState', [
        function () {
            return appState;
        }
    ])
})(angular.module('app'));