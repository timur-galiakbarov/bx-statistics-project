<?// подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
global $USER;
if (CModule::IncludeModule("iblock")) {
    $userId = $USER->GetID();
    $i = 0;
    $arSelect = Array("ID", "NAME", "PROPERTY_USER_ID");
    $arFilter = Array("IBLOCK_ID" => 16, "ACTIVE" => "Y", "PROPERTY_USER_ID_VALUE" => $userId);
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);

    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $shopIds[$i]["id"] = $arFields["ID"];
        $shopIds[$i]["name"] = $arFields["NAME"];
        $i++;
    }

    $data = Array(
        'user' => Array(
            'id'=>$userId,
            'userName' => $USER->GetFirstName(),
            'userLastName' => $USER->GetLastName(),
            'userFullName' => $USER->GetFullName(),
            'email' => $USER->GetEmail(),
            ),
        'shopIds' => $shopIds
    );

    print_r(json_encode(Array("data"=>$data)));
}
?>

<?//----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/epilog_after.php");?>