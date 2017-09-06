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
                            id: item.id,
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
                        age: item.age,
                        cities: item.cities,
                        countries: item.countries,
                        day: item.day,
                        reach: item.reach || 0,
                        reach_subscribers: item.reach_subscribers || 0,
                        sex: item.sex,
                        sex_age: item.sex_age,
                        subscribed: item.subscribed || 0,
                        unsubscribed: item.unsubscribed || 0,
                        views: item.views || 0,
                        visitors: item.visitors || 0
                    }
                })
            },
            ["wall.get"]: (res)=> {
                var arr = res.items.map((item)=> {
                    return {
                        attachment: item.attachment,
                        attachments: item.attachments,
                        can_delete: item.can_delete,
                        can_pin: item.can_pin,
                        comments: item.comments,
                        date: item.date,
                        from_id: item.form_id,
                        id: item.id,
                        is_pinned: item.is_pinned,
                        likes: item.likes,
                        marked_as_ads: item.marked_as_ads,
                        media: item.media,
                        online: item.online,
                        owner_id: item.to_id,
                        post_source: item.post_source,
                        post_type: item.post_type,
                        reply_count: item.reply_count,
                        reposts: item.reposts,
                        text: item.text
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