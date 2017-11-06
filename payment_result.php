<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
$iblockId = 4;

global $USER;
if (CModule::IncludeModule("iblock")) {

    if (!$_POST["sha1_hash"] || !$_POST["label"]) {
        die();
    }

    $userId = str_replace("user", "", $_POST["label"]);

    $el = new CIBlockElement;

    $secure = $_POST["notification_type"] . "&" .
        $_POST["operation_id"] . "&" .
        $_POST["amount"] . "&" .
        $_POST["currency"] . "&" .
        $_POST["datetime"] . "&" .
        $_POST["sender"] . "&" .
        $_POST["codepro"] . "&" .
        "RU9XTm8MxyfRyhhJ2uTkPcHJ" . "&" .
        $_POST["label"];

    $sha1 = sha1($secure);

    if ($sha1 === $_POST["sha1_hash"]) {

        $PROP = array();
        $PROP["SUMM"] = $_POST["withdraw_amount"];
        $PROP["SUMM_WITH_COMMISSION"] = $_POST["amount"];
        $PROP["CURRENCY"] = $_POST["currency"];
        $PROP["USER_ID"] = $userId;
        $PROP["DATETIME"] = $_POST["datetime"];
        $PROP["LABEL"] = $_POST["label"];
        $PROP["OPERATION_ID"] = $_POST["operation_id"];
        $PROP["NOTIFICATION_TYPE"] = $_POST["notification_type"];

        $arLoadProductArray = Array(
            "MODIFIED_BY" => $userId,
            "IBLOCK_SECTION_ID" => false,
            "IBLOCK_ID" => $iblockId,
            "PROPERTY_VALUES" => $PROP,
            "NAME" => "Платеж от пользователя с ID " . $userId,
            "ACTIVE" => "Y"
        );

        $ID = '';

        $ID = $el->Add($arLoadProductArray);

        //Установка даты и тарифа для пользователя
        global $USER;
        $user = new CUser;

        $arUser = CUser::GetByID($userId)->GetNext();

        $activeTo = "";
        $lastDate = date_parse_from_format("j.n.Y", $arUser["UF_ACTIVE_TO"]);
        $currentDate = date_parse_from_format("j.n.Y", date("d").".".date("m").".".date("Y"));

        if ($_POST["withdraw_amount"] == 99 || $_POST["withdraw_amount"] == 199) {
            $tariff = "Активный";
            if ($lastDate < $currentDate){
                $activeTo = date("d.m.Y", mktime(0, 0, 0, date("m") + 1, date("d") + 1, date("Y")));
            } else {
                $activeTo = date("d.m.Y", mktime(0, 0, 0, $lastDate["month"] + 1, $lastDate["day"] + 1, $lastDate["year"]));
            }
        }
        if ($_POST["withdraw_amount"] == 249 || $_POST["withdraw_amount"] == 499) {
            $tariff = "Активный";
            if ($lastDate < $currentDate){
                $activeTo = date("d.m.Y", mktime(0, 0, 0, date("m") + 3, date("d") + 1, date("Y")));
            } else {
                $activeTo = date("d.m.Y", mktime(0, 0, 0, $lastDate["month"] + 3, $lastDate["day"] + 1, $lastDate["year"]));
            }
        }
        if ($_POST["withdraw_amount"] == 999 || $_POST["withdraw_amount"] == 1399) {
            $tariff = "Активный";
            if ($lastDate < $currentDate){
                $activeTo = date("d.m.Y", mktime(0, 0, 0, date("m"), date("d") + 1, date("Y") + 1));
            } else {
                $activeTo = date("d.m.Y", mktime(0, 0, 0, $lastDate["month"], $lastDate["day"] + 1, $lastDate["year"] + 1));
            }
        }
        /*if ($_POST["withdraw_amount"] == 899) {
            if ($arUser["UF_TARIFF"] == "Бесплатный") {
                $activeTo = date("d.m.Y", mktime(0, 0, 0, date("m") + 6, date("d") + 1, date("Y")));
            } else {
                $lastDate = date_parse_from_format("j.n.Y", $arUser["UF_ACTIVE_TO"]);
                $activeTo = date("d.m.Y", mktime(0, 0, 0, $lastDate["month"] + 6, $lastDate["day"] + 1, $lastDate["year"]));
            }
        }*/

        $fields = Array(
            "UF_TARIFF" => $tariff,
            "UF_ACTIVE_TO" => $activeTo
        );
        $user->Update($userId, $fields);
    }
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>