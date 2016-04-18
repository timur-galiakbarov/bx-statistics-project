import bus from './../core/busModule.js';
import topics from './../topics.js';
import dataContext from './accountDataContext.js';
import {server} from 'core';

var serverApi = server;

bus.subscribe(topics.ACCOUNT.IS_AUTH, dataContext.isAuth);//Возвращает статус авторизации пользователя
bus.subscribe(topics.ACCOUNT.GET_USER_INFO, dataContext.getUserInfo);//Получение данных о пользователе
bus.subscribe(topics.ACCOUNT.LOGOUT, logout);//Получение данных о пользователе

function logout(){
    serverApi.request({
        url: '/controllers/account/logout.php',
        type: 'GET'
    }).then((res)=> {
        return res;
    }, (err)=> {
        return err;
    });
}