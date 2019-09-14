<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
global $USER;
if (CModule::IncludeModule("iblock")) {
    $userId = $USER->GetID();
    $arUser = CUser::GetByID($USER->GetID())->GetNext();

    $isActiveUser = true;

    if (strtotime($arUser["UF_ACTIVE_TO"]) < strtotime("now")) {
        $isActiveUser = false;
    }

    /*Получение списка групп для статистики на главной*/
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "ACTIVE_FROM", "PROPERTY_USER_ID", "PROPERTY_LIST");
    $arFilter = Array("IBLOCK_ID" => 7, "ACTIVE" => "Y", "PROPERTY_USER_ID" => $USER->GetID());
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);

    $statList = '';

    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $statList["id"] = $arFields["ID"];
        $statList["list"] = $arFields["PROPERTY_LIST_VALUE"];
    }


    $data = Array(
        'user' => Array(
            'id' => $userId,
            'userName' => $USER->GetFirstName(),
            'userLastName' => $USER->GetLastName(),
            'userFullName' => $USER->GetFullName(),
            'email' => $USER->GetEmail(),
            'loginVk' => $arUser["UF_VK_LOGIN"],
            'tokenVk' => $arUser["UF_VK_TOKEN"],
            "tariff" => $arUser["UF_TARIFF"],
            "activeTo" => $arUser["UF_ACTIVE_TO"],
            "isActiveUser" => $isActiveUser,
            "admin" => $USER->isAdmin(),
            "statList" => $statList
        )
    );

    //Проверка на имя и фамилию - если нет, то надо запросить и записать
    //if (!$USER->GetFirstName() || !$USER->GetLastName()) {
        $auth_data = json_decode(file_get_contents("https://api.vk.com/method/users.get?v=5.73&user_ids=" . $arUser["UF_VK_LOGIN"] . "&fields=photo_200&access_token=" . $arUser["UF_VK_TOKEN"]), true);

        $user = new CUser;
        $fields = Array(
            "NAME" => $auth_data["response"][0]["first_name"],
            "LAST_NAME" => $auth_data["response"][0]["last_name"],
            "PERSONAL_PHOTO" => CFile::MakeFileArray($auth_data["response"][0]["photo_200"]),
        );
        $user->Update($userId, $fields);

        $data['vk'] = $auth_data;
    //}

    print_r(json_encode(Array("data" => $data)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>