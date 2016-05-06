/**
 * Сервис хранения состояния пользователя
 */

import {bus} from 'core';
import events from '../events.js';
import topics from '../topics.js';

var userInfo = null;
var currentShop = null;
var mainStat = null;

bus.subscribe(events.ACCOUNT.STATED, saveUserProfile);
bus.subscribe(events.ACCOUNT.VK.AUTH, saveVkAuthInfo);
bus.subscribe(events.STAT.MAIN.FINISHED, saveMainStat);

function saveUserProfile(user) {
    userInfo = user.user ? user.user : null;
    currentShop = user.shopIds ? user.shopIds[0] : null;

    bus.publish(events.APP.READY);
}

function saveMainStat(res) {
    mainStat = res;
}

function saveVkAuthInfo(vkInfo) {
    userInfo.vkInfo = vkInfo || {};

    bus.publish(events.ACCOUNT.VK.INFO_READY);
}

var appState = {
    getUserId() {
        return userInfo ? userInfo.id : null;
    },
    getEmail() {
        return userInfo ? userInfo.email : null;
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
    user() {
        return userInfo
    },
    getMainStat(){
        return mainStat ? mainStat : ''
    }
};

(function (module) {
    module.factory('appState', [
        function () {
            return appState;
        }
    ])
})(angular.module('app'));