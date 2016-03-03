/**
 * —ервис хранени€ состо€ни€ пользовател€
 */

import {bus} from 'core';
import events from '../events.js';
import topics from '../topics.js';

var userInfo = null;
var currentShop = null;

bus.subscribe(events.ACCOUNT.STATED, saveUserProfile);
bus.subscribe(events.ACCOUNT.VK.AUTH, saveVkAuthInfo);

function saveUserProfile(user) {
    userInfo = user.user ? user.user : null;
    currentShop = user.shopIds ? user.shopIds[0] : null;

    bus.publish(events.APP.READY);
}

function saveVkAuthInfo(vkInfo) {
    userInfo.vkInfo =  vkInfo || {};

    bus.publish(events.ACCOUNT.VK.INFO_READY);
}

var appState = {
    getUserId() {
        return userInfo ? userInfo.id : null;
    },
    getUserShopList() {
        return userInfo ? userInfo.shopIds : null;
    },
    getCurrentShopId() {
        return currentShop.id ? currentShop.id : null;
    },
    getCurrentShopName() {
        return currentShop.name ? currentShop.name : null;
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
    socAuthInfo: {
        getVk: function(){
            return userInfo.vkInfo || {};
        }
    },
    user() {
        return userInfo
    }
};

(function (module) {
    module.factory('appState', [
        function () {
            return appState;
        }
    ])
})(angular.module('app'));