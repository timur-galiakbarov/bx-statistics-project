import {server} from 'core';
import vkApiMapper from './vkApiMapper.js';
import getWall from './statSections/wall.js';
import getGroupStat from './statSections/groupStat.js';
import getPhoto from './statSections/photo.js';
import getPhotoComments from './statSections/photoComments.js';
import getVideo from './statSections/video.js';
import bus from './../core/busModule.js';
import events from './../events.js';

var serverApi = server;

var config = {
    appId: "5358505",
    v: "5.131"
};

function errorAction(res) {
    if (res && res.error)
        switch (res.error.error_code) {
            case 10:
                /*notify.error("Произошла внутренняя ошибка сервера вконтакте. Пожалуйста, попробуйте повторить позже.");*/
                break;
            case 5:
                bus.publish(events.ACCOUNT.LOGOUT);
                break;
        }
}

export default {
    getBannedList(options){
        return serverApi.request({
            url: '/controllers/common/generateXLSX_getBannedList.php',
            type: 'POST',
            data: options
        }).then((res)=> {
            return res;
        });
    },
    getCompareList(options){
        return serverApi.request({
            url: '/controllers/common/generateXLSX_getCompareList.php',
            type: 'POST',
            data: options
        }).then((res)=> {
            return res;
        });
    },
    getFindAnalogList(options){
        return serverApi.request({
            url: '/controllers/common/generateXLSX_getFindAnalogList.php',
            type: 'POST',
            data: options
        }).then((res)=> {
            return res;
        });
    },
    getSectionList(options){
        return serverApi.request({
            url: '/controllers/stat/getContentSections.php',
            type: 'POST',
            data: options
        }).then((res)=> {
            return res;
        });
    },
    stat: {
        getWall(data){
            return getWall(data);
        },
        getGroupStat(data){
            return getGroupStat(data);
        },
        getPhoto(data){
            return getPhoto(data);
        },
        getPhotoComments(data){
            return getPhotoComments(data);
        },
        getVideo(data){
            return getVideo(data);
        }
    },
    vk: {
        getWall(authData, params){
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/wall.get",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: "-" + params.groupId,//Список групп
                    offset: params.offset,
                    count: params.count,
                    fileds: params.fields,
                    v: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? vkApiMapper["wall.get"](res.response) : res;
            });
        },
        getStat(authData, params){
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/stats.get",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    group_id: params.groupId,//Список групп
                    timestamp_from: new Date(params.dateFrom).getTime() / 1000,
                    timestamp_to: new Date(params.dateTo).getTime() / 1000,
                    //extended: true,
                    stats_groups: "visitors,reach,activity",
                    v: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? vkApiMapper["stats.get"](res.response) : res;
            });
        },
        getAllPhoto(authData, params){
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/photos.getAll",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: "-" + params.groupId,
                    count: params.count,
                    offset: params.offset,
                    extended: params.extended,
                    no_service_albums: params.no_service_albums,
                    v: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? vkApiMapper["photos.getAll"](res.response) : res;
            });
        },
        getPhotoCommentsStat(authData, params){
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/photos.getAllComments",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: "-" + params.groupId,
                    count: params.count,
                    offset: params.offset,
                    v: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? vkApiMapper["photos.getAllComments"](res.response) : res;
            });
        },
        getVideo(authData, params){
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/video.get",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: "-" + params.groupId,
                    count: params.count,
                    offset: params.offset,
                    extended: params.extended,
                    v: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? vkApiMapper["video.get"](res.response) : res;
            });
        },
        getGroupInfo(authData, params){
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.getById?access_token=" + authData.token,
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    group_id: params.groupId,//Список групп
                    fields: params.fields || "members_count,counters,description",
                    v: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? vkApiMapper["groups.getById"](res.response)[0] : res;
            });
        },
        getUsers(authData, params){
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/users.get?access_token=" + authData.token,
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    user_ids: params.user_ids,//Список Пользователей
                    name_case: params.name_case,//Падеж для склонения
                    fields: params.fields || "members_count,counters,description",
                    v: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? vkApiMapper["users.get"](res.response)[0] : res;
            });
        },
        isMember(authData, params){
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.isMember?access_token=" + authData.token,
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    group_id: params.group_id,
                    user_id: params.user_id,
                    extended: params.extended,
                    v: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? vkApiMapper["groups.isMember"](res.response) : res;
            });
        }
    }
}
