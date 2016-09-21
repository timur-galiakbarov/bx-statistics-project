import {server} from 'core';

var serverApi = server;
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
    }
}