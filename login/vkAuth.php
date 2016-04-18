<? // подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
$auth_data = json_decode(file_get_contents("https://api.vk.com/method/users.get?user_ids=" . $_GET["user_id"] . "&fields=photo_200"), true);

if ($_GET["user_id"] != NULL) {//Если получен Uid пользователя ВК
    global $USER;
    $filter = Array (
        "UF_VK_LOGIN" => $_GET["user_id"]
    );
    $rsUsers = CUser::GetList(($by="personal_country"), ($order="desc"), $filter); //выбираем пользователей
    $userId = "";
    while($rsUsers->NavNext(true, "f_")) :
        $userId = $f_ID;
    endwhile;

    if ($userId) {//Если пользователь найден, известен его $userId - авторизуем пользователя
        $user = new CUser;
        $fields = Array(
            "NAME"              => $auth_data["response"][0]["first_name"],
            "LAST_NAME"         => $auth_data["response"][0]["last_name"],
            "PERSONAL_PHOTO"    => CFile::MakeFileArray($auth_data["response"][0]["photo_200"]),
            "UF_VK_TOKEN"       => $_GET["access_token"]
        );
        $user->Update($userId, $fields);
        $USER->Authorize($userId);
        header("location: /lk");
    } else {//Id пользователя нет - регистрируем и авторизуем
        $user = new CUser;
        $arFields = Array(
            "NAME"              => $auth_data["response"][0]["first_name"],
            "LAST_NAME"         => $auth_data["response"][0]["last_name"],
            "EMAIL"             => "undefined@undefined.ru",
            "LOGIN"             => $_GET["user_id"],
            "LID"               => "ru",
            "ACTIVE"            => "Y",
            "GROUP_ID"          => array(10,11),
            "PASSWORD"          => "secretKey!+=2f_keys",
            "CONFIRM_PASSWORD"  => "secretKey!+=2f_keys",
            "PERSONAL_PHOTO"    => CFile::MakeFileArray($auth_data["response"][0]["photo_200"]),
            "UF_VK_LOGIN"       => $_GET["user_id"],
            "UF_VK_TOKEN"       => $_GET["access_token"]
        );

        $ID = $user->Add($arFields);
        if (intval($ID) > 0) {
            $USER->Authorize($ID);
            header("location: /lk");
        } else
            echo "Произошла ошибка. Пожалуйста, сообщите об этом администратору сайта.";
    }

    ?>

<? } ?>

<? //----------------------------------------------------------------------------

require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>