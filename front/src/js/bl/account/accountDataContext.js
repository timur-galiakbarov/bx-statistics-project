import {server} from 'core';

var serverApi = server;
export default {
    isAuth(options){
        return serverApi.request({
            url: '/controllers/account/isAuth.php',
            type: 'GET',
            notLogError: true
        }).then((res)=> {
            return res
        }, (err)=> {
            return err
        });
    },
    getUserInfo(options){
        return serverApi.request({
            url: '/controllers/account/getUserInfo.php',
            type: 'GET'
        }).then((res)=> {
                return res.data;
            }
        );
    },
    getFreeGroups(){
        return serverApi.request({
            url: '/controllers/account/freeGroups/getList.php',
            type: 'GET'
        }).then((res)=> {
                return res.data;
            }
        );
    },
    addGroupToFreeList(obj){
        return serverApi.request({
            url: '/controllers/account/freeGroups/add.php',
            type: 'POST',
            data: {
                group: obj.group,
                source: obj.source
            }
        }).then((res)=> {
                return res;
            }
        );
    },
    getVkInfo(options){

    },
    getNewsList(options){
        return serverApi.request({
            url: '/controllers/account/getNewsList.php',
            type: 'GET'
        }).then((res)=> {
                return res.data;
            }
        );
    },
    addBookmark(options){
        return serverApi.request({
            url: '/controllers/account/bookmarks/addBookmark.php',
            type: 'POST',
            data: options
        }).then((res)=> {
                return res;
            }
        );
    },
    getBookmarkList(options){
        return serverApi.request({
            url: '/controllers/account/bookmarks/getBookmarksList.php',
            type: 'GET'
        }).then((res)=> {
                return res.data;
            }
        );
    },
    removeBookmark(options){
        return serverApi.request({
            url: '/controllers/account/bookmarks/removeBookmark.php',
            type: 'POST',
            data: options
        }).then((res)=> {
                return res;
            }
        );
    },
    addFavorite(options){
        return serverApi.request({
            url: '/controllers/account/favorites/add.php',
            type: 'POST',
            data: options
        }).then((res)=> {
                return res;
            }
        );
    },
    getFavoriteList(options){
        return serverApi.request({
            url: '/controllers/account/favorites/getList.php',
            type: 'POST',
            data: options
        }).then((res)=> {
                return res;
            }
        );
    },
    removeFavorite(options){
        return serverApi.request({
            url: '/controllers/account/favorites/remove.php',
            type: 'POST',
            data: options
        }).then((res)=> {
                return res;
            }
        );
    },
    getAdminStat(){
        return serverApi.request({
            url: '/controllers/account/admin/getStat.php',
            type: 'GET'
        }).then((res)=> {
                return res;
            }
        );
    }
}