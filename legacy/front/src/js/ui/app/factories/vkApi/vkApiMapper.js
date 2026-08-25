(function (module, angular) {

    module.factory('vkApiMapper', vkApiMapper);

    function vkApiMapper() {
        return {
            ["groups.getById"]: (res)=> {
                return res.map((item)=> {
                    return {
                        gid: item.id,
                        is_admin: item.is_admin,
                        is_closed: item.is_closed,
                        is_member: item.is_member,
                        members_count: item.members_count,
                        name: item.name,
                        photo: item.photo_200,
                        photo_big: item.photo_200,
                        photo_medium: item.photo_100,
                        photo_small: item.photo_50,
                        screen_name: item.screen_name,
                        type: item.type
                    }
                });
            },
            ["groups.get"]: (res)=> {
                var arr = res.items.map((item)=> {
                    return {
                        admin_level: item.admin_level,
                        gid: item.id,
                        is_admin: item.is_admin,
                        is_closed: item.is_closed,
                        is_member: item.is_member,
                        members_count: item.members_count,
                        name: item.name,
                        photo: item.photo_200,
                        photo_big: item.photo_200,
                        photo_medium: item.photo_100,
                        photo_small: item.photo_50,
                        screen_name: item.screen_name,
                        type: item.type
                    }
                });
                arr.unshift(res.count);
                return arr;
            },
            ["groups.search"]: (res)=> {
                return {
                    count: res.count,
                    items: res.items.map((item)=> {
                        return {
                            gid: item.id,
                            is_admin: item.is_admin,
                            is_closed: item.is_closed,
                            is_member: item.is_member,
                            name: item.name,
                            photo_50: item.photo_50,
                            photo_100: item.photo_100,
                            photo_200: item.photo_200,
                            screen_name: item.screen_name,
                            type: item.type
                        }
                    })
                }
            },
            ["stats.get"]: (res)=> {
                return res.map((item)=> {
                    return {
                        age: item.reach.age && item.reach.age,
                        cities: item.visitors.cities,
                        countries: item.visitors.countries,
                        day: item.period_from * 1000,
                        reach: item.reach.reach || 0,
                        reach_subscribers: item.reach.reach_subscribers || 0,
                        sex: item.reach.sex,
                        sex_age: item.reach.sex_age,
                        subscribed: item.activity && item.activity.subscribed || 0,
                        unsubscribed: item.activity && item.activity.unsubscribed || 0,
                        views: item.visitors.views || 0,
                        visitors: item.visitors.visitors || 0
                    }
                })
            },
            ["wall.get"]: (res)=> {
                var arr = res.items.map((item)=> {
                    return {
                        attachments: item.attachments,
                        comments: item.comments,
                        date: item.date,
                        from_id: item.from_id,
                        id: item.id,
                        likes: item.likes,
                        marked_as_ads: item.marked_as_ads,
                        owner_id: item.owner_id,
                        post_source: item.post_source,
                        post_type: item.post_type,
                        reposts: item.reposts,
                        signer_id: item.signer_id,
                        text: item.text,
                        views: item.views,
                        can_delete: item.can_delete,
                        can_pin: item.can_pin,
                        is_pinned: item.is_pinned,
                        media: item.media,
                        online: item.online,
                        reply_count: item.reply_count
                    }
                });
                arr.unshift(res.count);
                return arr;
            },
            ["photos.getAlbums"]: (res)=> {
                var arr = res.items.map((item)=> {
                    return {
                        aid: item.id,
                        can_upload: item.can_upload,
                        comments_disabled: item.comments_disabled,
                        created: item.created,
                        description: item.description,
                        owner_id: item.owner_id,
                        size: item.size,
                        thumb_id: item.thumb_id,
                        thumb_is_last: item.thumb_is_last,
                        title: item.title,
                        updated: item.updated,
                        upload_by_admins_only: item.upload_by_admins_only
                    }
                });
                arr.unshift(res.count);
                return arr;
            },
            ["photos.getAll"]: (res)=> {
                return {
                    count: res.count,
                    items: res.items.map((item)=> {
                        return {
                            album_id: item.album_id,
                            date: item.date,
                            height: item.height,
                            id: item.id,
                            likes: item.likes,
                            owner_id: item.owner_id,
                            photo_75: item.photo_75,
                            photo_130: item.photo_130,
                            photo_604: item.photo_604,
                            photo_807: item.photo_807,
                            photo_1280: item.photo_1280,
                            photo_2560: item.photo_2560,
                            post_id: item.post_id,
                            reposts: item.reposts,
                            text: item.text,
                            user_id: item.user_id,
                            width: item.width
                        }
                    })
                }
            },
            ["photos.getAllComments"]: (res)=> {
                return {
                    count: res.count,
                    items: res.items.map((item)=> {
                        return {
                            date: item.date,
                            from_id: item.from_id,
                            id: item.id,
                            pid: item.pid,
                            text: item.text
                        }
                    })
                }
            },
            ["video.get"]: (res)=> {
                return {
                    count: res.count,
                    items: res.items.map((item)=> {
                        return {
                            adding_date: item.adding_date,
                            can_add: item.can_add,
                            can_comment: item.can_comment,
                            can_repost: item.can_repost,
                            comments: item.comments,
                            date: item.date,
                            description: item.description,
                            duration: item.duration,
                            id: item.id,
                            likes: item.likes,
                            owner_id: item.owner_id,
                            photo_130: item.photo_130,
                            photo_320: item.photo_320,
                            photo_640: item.photo_640,
                            platform: item.platform,
                            player: item.player,
                            repeat: item.repeat,
                            reposts: item.reposts,
                            title: item.title,
                            views: item.views
                        }
                    })
                }
            },
            ["users.get"]: (res)=>{
                return res.map((item)=>{
                    return {
                        first_name: item.first_name,
                        last_name: item.last_name,
                        photo_100: item.photo_100,
                        uid: item.id
                    }
                });
            }
        }
    }

})(angular.module("rad.common"), angular);
