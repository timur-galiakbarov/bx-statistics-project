import {server} from 'core';

var serverApi = server;
export default {
    getItems(options){
        return serverApi.request({
            url: '/controllers/shop/shopItems.php',
            type: 'GET',
            data: options
        }).then((res)=> {
            return res;
        });
    },
    addItem(options){
        return serverApi.request({
            url: '/controllers/shop/addItem.php',
            type: 'POST',
            data: options
        }).then((res)=> {
            return res;
        });
    },
    getItem(options){
        //console.log(options);
        return serverApi.request({
            url: '/controllers/shop/getItem.php',
            type: 'GET',
            data: options
        }).then((res)=> {
            return res;
        });
    },
    removeItem(options){
        return serverApi.request({
            url: '/controllers/shop/removeItem.php',
            type: 'POST',
            data: options
        }).then((res)=> {
            return res;
        });
    }
}