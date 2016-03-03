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
    getVkInfo(options){
        return serverApi.request({
            url: '/controllers/account/getVkInfo.php',
            type: 'GET'
        }).then((res)=> {
                return res.data;
            }
        );
    },
    logoutVk(){
        return serverApi.request({
            url: '/controllers/account/logoutVk.php',
            type: 'POST'
        }).then((res)=> {
                return res.data;
            }
        );
    }
}