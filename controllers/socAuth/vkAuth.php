<?// подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?
//Для соц.сети вконтакте
$auth_data = json_decode(file_get_contents("https://api.vk.com/method/users.get?user_ids=".$_GET["user_id"]."&fields=photo_200"),true);
if ($_GET["user_id"]!=NULL){//Если получен Uid пользователя ВК
    if(CModule::IncludeModule("iblock")){
        global $user;

        $user = new CUser;
        $fields = Array(
            "UF_LOGIN_VK" => $_GET["user_id"],
            "UF_TOKEN_VK" => $_GET["access_token"],
        );
        $user->Update($USER->GetId(), $fields);

        if (!$arUser["PERSONAL_PHOTO"]){
            $user = new CUser;
            $fieldsImg = Array(
                "PERSONAL_PHOTO" => CFile::MakeFileArray($auth_data["response"][0]["photo_200"]),
            );
            $user->Update($USER->GetId(), $fieldsImg);
        }
        if (!$arUser["LAST_NAME"]){
            $user = new CUser;
            $fieldsFName = Array(
                "LAST_NAME" => $auth_data["response"][0]["last_name"],
            );
            $user->Update($USER->GetId(), $fieldsFName);
        }
        if (!$arUser["NAME"]){
            $user = new CUser;
            $fieldsLName = Array(
                "NAME" => $auth_data["response"][0]["first_name"]
            );
            $user->Update($USER->GetId(), $fieldsLName);
        }
        header("Location: /lk/#/settings/");//переходим на страницу пользователя, после проведенных операций
    }
    ?>
<?}?>
<?//----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/epilog_after.php");?>