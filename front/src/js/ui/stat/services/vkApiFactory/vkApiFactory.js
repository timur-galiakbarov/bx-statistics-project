import topics from './../../../../bl/topics.js';
import events from './../../../../bl/events.js';

(function (module, angular) {

    module.factory('vkApiFactory', vkApiFactory);

    vkApiFactory.$inject = ['bus', 'appState', 'notify'];

    function vkApiFactory(bus, appState, notify) {

        var config = {
            appId: "5358505",
            v: "3.0"
        };

        var getGroupInfo = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.getById?access_token=" + authData.token,
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    group_id: params.groupId,//Список групп
                    fields: params.fields || "members_count,counters,description",
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response[0] : res;
            });

        };

        var getGroupsInfo = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.getById?access_token=" + authData.token,
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    group_ids: params.groupIds,//Список групп
                    fields: params.fields || "members_count,counters,photo",
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
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
                    date_to: params.dateTo,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
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
                    count: params.count,
                    fileds: params.fields,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
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
                    count: params.count,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var getAlbums = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/photos.getAlbums",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: params.groupId,
                    count: params.count,
                    offset: params.offset,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var getAllPhoto = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/photos.getAll",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: params.groupId,
                    count: params.count,
                    offset: params.offset,
                    extended: params.extended,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var getAllCommentsPhoto = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/photos.getAllComments",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: params.groupId,
                    count: params.count,
                    offset: params.offset,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var getVideos = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/video.get",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: params.groupId,
                    count: params.count,
                    offset: params.offset,
                    extended: params.extended,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var getCurrentUserInfo = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/users.get",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    fields: params.fields || '',
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var getGroupMembers = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.getMembers",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    group_id: params.groupId,
                    sort: params.sortData,
                    offset: params.offset,
                    count: params.count,
                    fields: "counters,contacts",
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var wallGetById = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/wall.getById",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    posts: params.posts,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var getGroupCategories = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.getCatalogInfo",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    subcategories: 1,
                    extended: 1,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var getCategoryGroups = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.getCatalog",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    category_id: params.category_id,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response ? res.response : res;
            });
        };

        var isMember = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.isMember",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    group_id: params.groupId,
                    user_id: params.userId,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response || res.response === 0 ? res.response : res;
            });
        };

        var getVideo = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/video.get",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    owner_id: params.owner_id,
                    videos: params.videos,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response || res.response === 0 ? res.response : res;
            });
        };

        var searchGroup = function (authData, params) {
            return $.ajax({
                type: "GET",
                url: "https://api.vk.com/method/groups.search",
                dataType: 'jsonp',
                data: {
                    access_token: authData.token,//Токен
                    v: "5.53",
                    q: params.q,
                    type: params.type,
                    country_id: params.country_id,
                    sort: params.sort,
                    count: params.count,
                    version: config.v
                }
            }).then(function (res) {
                errorAction(res);
                return res.response || res.response === 0 ? res.response : res;
            });
        };

        var execute = {
            getWallPosts: function (authData, params) {
                return $.ajax({
                    type: "GET",
                    url: "https://api.vk.com/method/execute.getWallPosts",
                    dataType: 'jsonp',
                    data: {
                        groupId: params.groupId,
                        offset: params.offset,
                        fields: params.fields,
                        access_token: authData.token,//Токен
                        version: config.v
                    }
                }).then(function (res) {
                    errorAction(res);
                    if (res.response) {
                        var arr = [];
                        res.response.forEach((item)=> {
                            arr.push(item);
                        });
                        return arr;
                    } else {
                        return res;
                    }
                });
            },
            getGroupMembers: function (authData, params) {
                return $.ajax({
                    type: "GET",
                    url: "https://api.vk.com/method/execute.getGroupMembers",
                    dataType: 'jsonp',
                    data: {
                        groupId: params.groupId,
                        offset: params.offset,
                        fields: params.fields,
                        access_token: authData.token,//Токен
                        version: config.v
                    }
                }).then(function (res) {
                    errorAction(res);
                    return res && res.response ? res.response : res;
                });
            },
            getBannedList: function (authData, params) {
                return $.ajax({
                    type: "GET",
                    url: "https://api.vk.com/method/execute.getBannedList",
                    dataType: 'jsonp',
                    data: {
                        groupId: params.groupId,
                        offset: params.offset,
                        fields: params.fields,
                        access_token: authData.token,//Токен
                        version: config.v
                    }
                }).then(function (res) {
                    errorAction(res);
                    return res && res.response ? res.response : res;
                });
            },
            getSubscribersGroups: function (authData, params) {
                var data = {
                    access_token: authData.token,//Токен
                    version: config.v
                };
                params.userIds.forEach((user, i)=> {
                    data["user" + i] = user;
                });
                return $.ajax({
                    type: "GET",
                    url: "https://api.vk.com/method/execute.getSubscribersGroups",
                    dataType: 'jsonp',
                    data: data
                }).then(function (res) {
                    errorAction(res);
                    return res && res.response ? res.response : res;
                });
            },
            getUsersInfoByIds: function (authData, params) {
                return $.ajax({
                    type: "GET",
                    url: "https://api.vk.com/method/execute.getUsersInfoByIds",
                    dataType: 'jsonp',
                    data: {
                        userIds: params.userIds,
                        fields: params.fields,
                        access_token: authData.token,//Токен
                        version: config.v
                    }
                }).then(function (res) {
                    errorAction(res);
                    return res && res.response ? res.response : res;
                });
            }
        };

        function errorAction(res) {
            if (res && res.error)
                switch (res.error.error_code) {
                    case 10:
                        notify.error("Произошла внутренняя ошибка сервера вконтакте. Пожалуйста, попробуйте повторить позже.");
                        break;
                    case 5:
                        bus.publish(events.ACCOUNT.LOGOUT);
                        break;
                }
        }

        return {
            getGroupInfo: getGroupInfo,
            getGroupsInfo: getGroupsInfo,
            getStat: getStat,
            getWall: getWall,
            getUserGroups: getUserGroups,
            getAlbums: getAlbums,
            getAllPhoto: getAllPhoto,
            getAllCommentsPhoto: getAllCommentsPhoto,
            getVideos: getVideos,
            getCurrentUserInfo: getCurrentUserInfo,
            getGroupMembers: getGroupMembers,
            wallGetById: wallGetById,
            getGroupCategories: getGroupCategories,
            isMember: isMember,
            getVideo: getVideo,
            searchGroup: searchGroup,
            execute: execute
        }

    }

})(angular.module("rad.stat"), angular);