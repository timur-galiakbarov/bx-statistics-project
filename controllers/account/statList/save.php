<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
$iblockId = 7;

global $USER;
if (CModule::IncludeModule("iblock")) {
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "ACTIVE_FROM", "PROPERTY_USER_ID", "PROPERTY_LIST");
    $arFilter = Array("IBLOCK_ID" => $iblockId, "ACTIVE" => "Y", "PROPERTY_USER_ID" => $USER->GetID());
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);
    $userElement = Array();
    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $userElement = $arFields;
    }

    $el = new CIBlockElement;

    $PROP = array();
    $PROP["USER_ID"] = $USER->GetID();
    $PROP["LIST"] = $_POST["list"];

    $arLoadProductArray = Array(
        "MODIFIED_BY" => $USER->GetID(),
        "IBLOCK_SECTION_ID" => false,
        "IBLOCK_ID" => $iblockId,
        "PROPERTY_VALUES" => $PROP,
        "NAME" => $USER->GetFullName(),
        "ACTIVE" => "Y"
    );

    $ID = '';

    if (!($userElement && $userElement["ID"])) {
        $ID = $el->Add($arLoadProductArray);
    } else {
        $el->Update($userElement["ID"], $arLoadProductArray);
        $ID = $userElement["ID"];
    }


    print_r(json_encode(Array("success" => true, "id" => $ID)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>