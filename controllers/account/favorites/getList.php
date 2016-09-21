<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
$iblockId = 3;

if (CModule::IncludeModule("iblock")) {
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "ACTIVE_FROM", "PROPERTY_USER_ID", "PROPERTY_POST_ID");
    $arFilter = Array("IBLOCK_ID" => $iblockId, "ACTIVE" => "Y", "PROPERTY_USER_ID" => $USER->GetID());
    $res = CIBlockElement::GetList(Array("DATE_CREATE" => "DESC"), $arFilter, false, false, $arSelect);

    $list = Array();

    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        array_push($list, Array(
            "postId" => $arFields["PROPERTY_POST_ID_VALUE"],
            "id" => $arFields["ID"]
        ));
    }

    print_r(json_encode(Array("data" => $list)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>